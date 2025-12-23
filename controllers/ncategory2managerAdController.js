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
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return s.slice(0, 10); // YYYY-MM-DD
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
        COALESCE(slot_type,'') AS slot_type,
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

// ✅ 슬롯 저장(업서트) - slot_type NOT NULL 대응 포함
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

    // ✅ no_end=true면 end_at은 null
    const finalEndAt = no_end ? null : end_at;

    // ✅ 기존값 조회(이미지/slot_type 유지용)
    const prev = await pool.query(
      `
      SELECT
        COALESCE(image_url,'') AS image_url,
        COALESCE(slot_type,'') AS slot_type
      FROM ${TABLE}
      WHERE page=$1 AND position=$2 AND priority=$3
      LIMIT 1
      `,
      [page, position, priority]
    );

    const prevImage = prev.rows[0]?.image_url || "";
    const prevSlotType = prev.rows[0]?.slot_type || "";

    // ✅ 업로드된 이미지가 있으면 /uploads/파일명으로 저장, 없으면 기존값 유지
    let image_url = prevImage;
    if (req.file?.filename) image_url = `/uploads/${req.file.filename}`;

    // ✅ slot_type (NOT NULL) 보정: (요청값 > 기존값 > 이미지 있으면 image > text)
    const reqSlotType = clean(req.body.slot_type); // 프론트가 보내면 그대로 수용
    const slot_type = reqSlotType || prevSlotType || (image_url ? "image" : "text");

    // ✅ 테이블에 유니크가 있으면 ON CONFLICT가 동작 (page, position, priority)
    // (없으면 fallback 로직)
    try {
      await pool.query(
        `
        INSERT INTO ${TABLE}
          (page, position, priority, slot_type, text_content, image_url, link_url, start_at, end_at, no_end, updated_at)
        VALUES
          ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
        ON CONFLICT (page, position, priority)
        DO UPDATE SET
          slot_type=EXCLUDED.slot_type,
          text_content=EXCLUDED.text_content,
          image_url=EXCLUDED.image_url,
          link_url=EXCLUDED.link_url,
          start_at=EXCLUDED.start_at,
          end_at=EXCLUDED.end_at,
          no_end=EXCLUDED.no_end,
          updated_at=NOW()
        `,
        [page, position, priority, slot_type, text_content, image_url, link_url, start_at, finalEndAt, no_end]
      );
    } catch (e) {
      // ✅ fallback: update 먼저, 안되면 insert
      const upd = await pool.query(
        `
        UPDATE ${TABLE}
        SET
          slot_type=$4,
          text_content=$5,
          image_url=$6,
          link_url=$7,
          start_at=$8,
          end_at=$9,
          no_end=$10,
          updated_at=NOW()
        WHERE page=$1 AND position=$2 AND priority=$3
        `,
        [page, position, priority, slot_type, text_content, image_url, link_url, start_at, finalEndAt, no_end]
      );

      if (upd.rowCount === 0) {
        await pool.query(
          `
          INSERT INTO ${TABLE}
            (page, position, priority, slot_type, text_content, image_url, link_url, start_at, end_at, no_end, created_at, updated_at)
          VALUES
            ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW())
          `,
          [page, position, priority, slot_type, text_content, image_url, link_url, start_at, finalEndAt, no_end]
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

    await pool.query(`DELETE FROM ${TABLE} WHERE page=$1 AND position=$2 AND priority=$3`, [
      page,
      position,
      priority,
    ]);

    return res.json({ ok: true });
  } catch (err) {
    console.error("[ncategory2manager] deleteSlot error:", err);
    return res.status(500).json({ ok: false, message: err.message });
  }
}

// ✅ 가게 검색(이름/사업자번호) - combined_store_info만
export async function searchStore(req, res) {
  try {
    const bizNo = digitsOnly(req.query.bizNo);
    const q = clean(req.query.q);

    const params = [];
    const where = [];

    if (bizNo) {
      params.push(`%${bizNo}%`);
      where.push(
        `regexp_replace(COALESCE(business_number::text,''), '[^0-9]', '', 'g') ILIKE $${params.length}`
      );
    }

    if (q) {
      params.push(`%${q}%`);
      where.push(
        `(business_name ILIKE $${params.length} OR COALESCE(business_category,'') ILIKE $${params.length})`
      );
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const sql = `
      SELECT
        'combined' AS store_type,
        id::text AS id,
        regexp_replace(COALESCE(business_number::text,''), '[^0-9]', '', 'g') AS business_no,
        business_name,
        COALESCE(business_category,'') AS category
      FROM public.combined_store_info
      ${whereSql}
      ORDER BY business_name
      LIMIT 50
    `;

    const { rows } = await pool.query(sql, params);
    return res.json({ ok: true, stores: rows });
  } catch (err) {
    console.error("[ncategory2manager] searchStore error:", err);
    return res.status(500).json({ ok: false, message: err.message });
  }
}
