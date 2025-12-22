// controllers/ncategory2managerAdController.js
import pool from "../db.js";

function clean(v) {
  if (v === undefined || v === null) return "";
  return String(v).trim();
}

function toBool(v) {
  const s = String(v ?? "").toLowerCase().trim();
  return s === "true" || s === "1" || s === "yes" || s === "y" || s === "on";
}

function digitsOnly(v) {
  return clean(v).replace(/[^\d]/g, "");
}

function toDateOrNull(v) {
  const s = clean(v);
  if (!s) return null;
  // "YYYY-MM-DD" 또는 ISO 일부도 허용
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return s.slice(0, 10);
}

const TABLE = "public.admin_ad_slots";

// ✅ 슬롯 조회
export async function getSlot(req, res) {
  try {
    const page = clean(req.query.page);
    const position = clean(req.query.position);
    const priority = Number(req.query.priority ?? 1) || 1;

    if (!page || !position) {
      return res.status(400).json({ ok: false, message: "page/position required" });
    }

    const { rows } = await pool.query(
      `
      SELECT
        page,
        position,
        priority,
        COALESCE(text_content,'') AS text_content,
        COALESCE(image_url,'') AS image_url,
        COALESCE(link_url,'') AS link_url,
        start_at,
        end_at,
        COALESCE(no_end,false) AS no_end,
        created_at,
        updated_at
      FROM ${TABLE}
      WHERE page=$1 AND position=$2 AND priority=$3
      LIMIT 1
      `,
      [page, position, priority]
    );

    return res.json({ ok: true, slot: rows[0] || null });
  } catch (err) {
    console.error("[ncategory2manager] getSlot error:", err);
    return res.status(500).json({ ok: false, message: err.message });
  }
}

// ✅ 슬롯 저장(업서트)
export async function saveSlot(req, res) {
  try {
    const page = clean(req.body.page);
    const position = clean(req.body.position);
    const priority = Number(req.body.priority ?? 1) || 1;

    if (!page || !position) {
      return res.status(400).json({ ok: false, message: "page/position required" });
    }

    const text_content = clean(req.body.text_content);
    const link_url = clean(req.body.link_url);
    const start_at = toDateOrNull(req.body.start_at);
    const end_at = toDateOrNull(req.body.end_at);
    const no_end = toBool(req.body.no_end);

    // ✅ 업로드된 이미지가 있으면 /uploads/파일명으로 저장
    let image_url = "";
    if (req.file?.filename) {
      image_url = `/uploads/${req.file.filename}`;
    } else {
      // 업로드 없으면 기존값 유지
      const prev = await pool.query(
        `SELECT COALESCE(image_url,'') AS image_url
         FROM ${TABLE}
         WHERE page=$1 AND position=$2 AND priority=$3
         LIMIT 1`,
        [page, position, priority]
      );
      image_url = prev.rows[0]?.image_url || "";
    }

    // ✅ no_end=true면 end_at은 null로 처리(헷갈림 방지)
    const finalEndAt = no_end ? null : end_at;

    // ✅ 테이블에 유니크가 있으면 ON CONFLICT가 동작
    // (없으면 에러 나니까 fallback 로직도 같이 둠)
    try {
      await pool.query(
        `
        INSERT INTO ${TABLE}
          (page, position, priority, text_content, image_url, link_url, start_at, end_at, no_end, updated_at)
        VALUES
          ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
        ON CONFLICT (page, position, priority)
        DO UPDATE SET
          text_content=EXCLUDED.text_content,
          image_url=EXCLUDED.image_url,
          link_url=EXCLUDED.link_url,
          start_at=EXCLUDED.start_at,
          end_at=EXCLUDED.end_at,
          no_end=EXCLUDED.no_end,
          updated_at=NOW()
        `,
        [page, position, priority, text_content, image_url, link_url, start_at, finalEndAt, no_end]
      );
    } catch (e) {
      // ✅ fallback: update 먼저, 안되면 insert
      const upd = await pool.query(
        `
        UPDATE ${TABLE}
        SET text_content=$4, image_url=$5, link_url=$6, start_at=$7, end_at=$8, no_end=$9, updated_at=NOW()
        WHERE page=$1 AND position=$2 AND priority=$3
        `,
        [page, position, priority, text_content, image_url, link_url, start_at, finalEndAt, no_end]
      );

      if (upd.rowCount === 0) {
        await pool.query(
          `
          INSERT INTO ${TABLE}
            (page, position, priority, text_content, image_url, link_url, start_at, end_at, no_end, created_at, updated_at)
          VALUES
            ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),NOW())
          `,
          [page, position, priority, text_content, image_url, link_url, start_at, finalEndAt, no_end]
        );
      }
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("[ncategory2manager] saveSlot error:", err);
    return res.status(500).json({ ok: false, message: err.message });
  }
}

// ✅ 슬롯 삭제(레코드 삭제, 파일은 삭제 안 함)
export async function deleteSlot(req, res) {
  try {
    const page = clean(req.query.page);
    const position = clean(req.query.position);
    const priority = Number(req.query.priority ?? 1) || 1;

    if (!page || !position) {
      return res.status(400).json({ ok: false, message: "page/position required" });
    }

    await pool.query(
      `DELETE FROM ${TABLE} WHERE page=$1 AND position=$2 AND priority=$3`,
      [page, position, priority]
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error("[ncategory2manager] deleteSlot error:", err);
    return res.status(500).json({ ok: false, message: err.message });
  }
}

// ✅ 가게 검색(이름/사업자번호)
export async function searchStore(req, res) {
  try {
    const bizNo = digitsOnly(req.query.bizNo);
    const q = clean(req.query.q);

    // ✅ 가능한 범위에서 “전체 가게”에 가까운 테이블들을 union
    // - combined_store_info
    // - store_info
    // (없어도 에러 안 나게 하려면 실제로 존재하는 테이블로만 쓰는게 정답인데,
    //  지금은 ncategory2가 “전체 카테고리”라 이 2개를 우선으로 둠)
    const params = [];
    let where = "WHERE 1=1";

    if (bizNo) {
      params.push(`%${bizNo}%`);
      where += ` AND regexp_replace(COALESCE(business_number::text,''), '[^0-9]', '', 'g') ILIKE $${params.length}`;
    }

    if (q) {
      params.push(`%${q}%`);
      where += ` AND (business_name ILIKE $${params.length} OR COALESCE(business_category,'') ILIKE $${params.length})`;
    }

    const sql = `
      SELECT
        'combined' AS store_type,
        id::text AS id,
        regexp_replace(COALESCE(business_number::text,''), '[^0-9]', '', 'g') AS business_no,
        business_name,
        COALESCE(business_category,'') AS category
      FROM public.combined_store_info
      ${where}

      UNION ALL

      SELECT
        'store_info' AS store_type,
        id::text AS id,
        regexp_replace(COALESCE(business_number::text,''), '[^0-9]', '', 'g') AS business_no,
        business_name,
        COALESCE(business_category,'') AS category
      FROM public.store_info
      ${where}

      ORDER BY business_name
      LIMIT 50
    `;

    const { rows } = await pool.query(sql, [...params, ...params]);

    return res.json({ ok: true, stores: rows });
  } catch (err) {
    console.error("[ncategory2manager] searchStore error:", err);
    return res.status(500).json({ ok: false, message: err.message });
  }
}
