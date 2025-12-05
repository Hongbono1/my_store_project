// controllers/indexmanagerAdController.js
import pool from "../db.js";

/**
 * 공통: page / position 검증
 */
function ensurePagePosition(page, position) {
  if (!page || !position) {
    const err = new Error("page, position 값이 필요합니다.");
    err.statusCode = 400;
    throw err;
  }
}

/**
 * INDEX 메인 배너 / 프로모 등 이미지 + 링크 저장
 * POST /manager/ad/upload
 * - multipart/form-data
 * - 필드: page, position, link_url, start_date, end_date, start_time, end_time
 * - 파일: image
 */
// ==============================
// 🔸 인덱스 광고 슬롯 업로드
// ==============================
export async function uploadIndexAd(req, res) {
  try {
    // 폼에서 넘어오는 값들 (name 기준)
    const {
      page,
      position,
      slotType,
      slotMode,
      linkUrl,
      textContent,
      storeId,
      businessNo,
      businessName,
      startDate,
      endDate,
    } = req.body;

    // 파일 업로드 (multer: upload.single("image"))
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    // slot_type 제약조건 맞추기 ('banner' 또는 'text'만 허용)
    const slot_type = slotType === "text" ? "text" : "banner";

    // slot_mode 기본값
    const slot_mode = slotMode || "custom";

    // store_id는 integer라서 숫자/NULL로 정리
    const store_id =
      storeId && storeId.toString().trim() !== ""
        ? Number(storeId)
        : null;

    const sql = `
      INSERT INTO admin_ad_slots (
        page,
        position,
        slot_type,
        image_url,
        link_url,
        text_content,
        slot_mode,
        store_id,
        business_no,
        business_name,
        start_date,
        end_date
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12
      )
      ON CONFLICT (page, position)
      DO UPDATE SET
        slot_type     = EXCLUDED.slot_type,
        image_url     = EXCLUDED.image_url,
        link_url      = EXCLUDED.link_url,
        text_content  = EXCLUDED.text_content,
        slot_mode     = EXCLUDED.slot_mode,
        store_id      = EXCLUDED.store_id,
        business_no   = EXCLUDED.business_no,
        business_name = EXCLUDED.business_name,
        start_date    = EXCLUDED.start_date,
        end_date      = EXCLUDED.end_date,
        updated_at    = now()
      RETURNING *;
    `;

    const params = [
      page,
      position,
      slot_type,
      imageUrl,
      linkUrl || null,
      textContent || null,
      slot_mode,
      store_id,
      businessNo || null,
      businessName || null,
      startDate || null, // "YYYY-MM-DD" 문자열이면 date 컬럼에 바로 저장 가능
      endDate || null,
    ];

    const { rows } = await pool.query(sql, params);

    return res.json({
      ok: true,
      slot: rows[0],
    });
  } catch (err) {
    console.error("UPLOAD INDEX AD ERROR:", err);
    return res.status(500).json({
      ok: false,
      message: "slot 저장 오류",
      code: "INDEX_AD_SAVE_ERROR",
    });
  }
}

/**
 * 등록된 가게(사업자번호 + 상호)로 슬롯 연결
 * POST /manager/ad/store
 * - JSON: { page, position, biz_number, biz_name, start_date, ... }
 *   (지금은 DB에 정보만 저장하고, 실제 상세 링크 연결은 나중에 구현해도 됨)
 */
export async function saveIndexStoreAd(req, res) {
  try {
    const {
      page,
      position,
      biz_number,
      biz_name,
      start_date,
      end_date,
      start_time,
      end_time,
    } = req.body;

    ensurePagePosition(page, position);

    if (!biz_number || !biz_name) {
      return res.status(400).json({
        ok: false,
        message: "사업자번호와 상호명을 모두 입력해야 합니다.",
      });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const existing = await client.query(
        `
        SELECT id
        FROM admin_ad_slots
        WHERE page = $1 AND position = $2
        ORDER BY updated_at DESC NULLS LAST, id DESC
        LIMIT 1
      `,
        [page, position]
      );

      if (existing.rowCount > 0) {
        const id = existing.rows[0].id;
        await client.query(
          `
          UPDATE admin_ad_slots
          SET
            biz_number = $1,
            biz_name   = $2,
            start_date = $3,
            end_date   = $4,
            start_time = $5,
            end_time   = $6,
            updated_at = NOW()
          WHERE id = $7
        `,
          [
            biz_number,
            biz_name,
            start_date || null,
            end_date || null,
            start_time || null,
            end_time || null,
            id,
          ]
        );
      } else {
        await client.query(
          `
          INSERT INTO admin_ad_slots
            (page, position,
             biz_number, biz_name,
             start_date, end_date, start_time, end_time,
             created_at, updated_at)
          VALUES
            ($1, $2,
             $3, $4,
             $5, $6, $7, $8,
             NOW(), NOW())
        `,
          [
            page,
            position,
            biz_number,
            biz_name,
            start_date || null,
            end_date || null,
            start_time || null,
            end_time || null,
          ]
        );
      }

      await client.query("COMMIT");
      return res.json({ ok: true });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("SAVE INDEX STORE AD ERROR:", err);
      return res.status(500).json({
        ok: false,
        message: "slot 저장 오류",
        code: "INDEX_STORE_AD_SAVE_ERROR",
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("SAVE INDEX STORE AD FATAL:", err);
    const status = err.statusCode || 500;
    return res
      .status(status)
      .json({ ok: false, message: err.message || "server error" });
  }
}

/**
 * ==============================
 * 🔹 인덱스 광고 슬롯 조회 API
 * GET /manager/ad/slot?page=index&position=index_main_top
 * ==============================
 */
export async function getIndexSlot(req, res) {
  try {
    const { page, position } = req.query;

    if (!page || !position) {
      return res.status(400).json({
        ok: false,
        message: "page, position이 필요합니다.",
      });
    }

    const sql = `
      SELECT
        id,
        page,
        position,
        slot_type,
        image_url,
        link_url,
        text_content,
        slot_mode,
        store_id,
        business_no,
        business_name,
        start_date,
        end_date
      FROM admin_ad_slots
      WHERE page = $1 AND position = $2
      LIMIT 1
    `;

    const { rows } = await pool.query(sql, [page, position]);

    // 슬롯이 아직 등록되지 않은 경우: slot = null
    if (rows.length === 0) {
      return res.json({
        ok: true,
        slot: null,
      });
    }

    return res.json({
      ok: true,
      slot: rows[0],
    });
  } catch (err) {
    console.error("GET INDEX SLOT ERROR:", err);
    return res.status(500).json({
      ok: false,
      message: "슬롯 조회 오류",
      code: "INDEX_AD_LOAD_ERROR",
    });
  }
}

/**
 * 텍스트 슬롯 가져오기
 * GET /manager/ad/text/get?page=index&position=index_sub_keywords
 */
export async function getIndexText(req, res) {
  try {
    const { page, position } = req.query;
    ensurePagePosition(page, position);

    const { rows } = await pool.query(
      `
      SELECT
        id, page, position, content,
        created_at, updated_at
      FROM admin_ad_texts
      WHERE page = $1 AND position = $2
      ORDER BY updated_at DESC NULLS LAST, id DESC
      LIMIT 1
    `,
      [page, position]
    );

    if (rows.length === 0) {
      return res.json({ ok: true, text: null });
    }

    return res.json({ ok: true, text: rows[0] });
  } catch (err) {
    console.error("GET INDEX TEXT ERROR:", err);
    return res
      .status(500)
      .json({ ok: false, message: "텍스트 조회 오류", code: "INDEX_TEXT_GET_ERROR" });
  }
}

/**
 * 텍스트 슬롯 저장
 * POST /manager/ad/text/save
 * - JSON: { page, position, content }
 */
export async function saveIndexText(req, res) {
  try {
    const { page, position, content } = req.body;
    ensurePagePosition(page, position);

    if (!content || !content.trim()) {
      return res
        .status(400)
        .json({ ok: false, message: "내용을 입력해야 합니다." });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const existing = await client.query(
        `
        SELECT id
        FROM admin_ad_texts
        WHERE page = $1 AND position = $2
        ORDER BY updated_at DESC NULLS LAST, id DESC
        LIMIT 1
      `,
        [page, position]
      );

      if (existing.rowCount > 0) {
        const id = existing.rows[0].id;
        await client.query(
          `
          UPDATE admin_ad_texts
          SET content = $1,
              updated_at = NOW()
          WHERE id = $2
        `,
          [content, id]
        );
      } else {
        await client.query(
          `
          INSERT INTO admin_ad_texts
            (page, position, content, created_at, updated_at)
          VALUES
            ($1, $2, $3, NOW(), NOW())
        `,
          [page, position, content]
        );
      }

      await client.query("COMMIT");
      return res.json({ ok: true });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("SAVE INDEX TEXT ERROR:", err);
      return res.status(500).json({
        ok: false,
        message: "텍스트 저장 오류",
        code: "INDEX_TEXT_SAVE_ERROR",
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("SAVE INDEX TEXT FATAL:", err);
    const status = err.statusCode || 500;
    return res
      .status(status)
      .json({ ok: false, message: err.message || "server error" });
  }
}

/**
 * POST /manager/ad/text/save
 * 텍스트 슬롯 저장
 */
export async function saveIndexTextSlot(req, res) {
  try {
    const { page, position, content } = req.body;

    if (!page || !position) {
      return res.status(400).json({
        ok: false,
        message: "page와 position은 필수입니다.",
      });
    }

    if (!content || content.trim() === "") {
      return res.status(400).json({
        ok: false,
        message: "텍스트 내용을 입력해주세요.",
      });
    }

    // UPSERT - 텍스트 슬롯 저장
    const sql = `
      INSERT INTO admin_ad_slots (
        page, position, slot_type, text_content, updated_at
      )
      VALUES ($1, $2, 'text', $3, NOW())
      ON CONFLICT (page, position)
      DO UPDATE SET
        slot_type = 'text',
        text_content = EXCLUDED.text_content,
        updated_at = NOW()
      RETURNING *
    `;

    const { rows } = await pool.query(sql, [page, position, content.trim()]);

    return res.json({
      ok: true,
      slot: rows[0],
    });
  } catch (err) {
    console.error("SAVE TEXT SLOT ERROR:", err);
    return res.status(500).json({
      ok: false,
      message: "텍스트 저장 실패",
      error: err.message,
    });
  }
}

// ==============================
// 🔹 인덱스 텍스트 슬롯 조회 API
// GET /manager/ad/text/get?page=index&position=index_sub_keywords
// ==============================
export async function getIndexTextSlot(req, res) {
  try {
    const { page, position } = req.query;

    if (!page || !position) {
      return res.status(400).json({
        ok: false,
        message: "page, position이 필요합니다.",
      });
    }

    const sql = `
      SELECT
        id,
        page,
        position,
        slot_type,
        image_url,
        link_url,
        text_content,
        slot_mode,
        store_id,
        business_no,
        business_name,
        start_date,
        end_date
      FROM admin_ad_slots
      WHERE page = $1
        AND position = $2
        AND slot_type = 'text'
      LIMIT 1
    `;

    const { rows } = await pool.query(sql, [page, position]);

    if (rows.length === 0) {
      // 아직 등록된 텍스트 슬롯이 없으면 slot=null로 응답
      return res.json({
        ok: true,
        slot: null,
      });
    }

    return res.json({
      ok: true,
      slot: rows[0],
    });
  } catch (err) {
    console.error("GET INDEX TEXT SLOT ERROR:", err);
    return res.status(500).json({
      ok: false,
      message: "텍스트 슬롯 조회 오류",
      code: "INDEX_TEXT_LOAD_ERROR",
    });
  }
}
