// controllers/indexmanagerAdController.js
import pool from "../db.js";

/**
 * 이미지 + 링크 저장 (배너 슬롯)
 * POST /index/ad/upload
 * FormData: page, position, link_url, image(file)
 */
export async function saveBannerSlot(req, res) {
  try {
    const { page, position, link_url } = req.body;
    const file = req.file;

    if (!page || !position) {
      return res
        .status(400)
        .json({ ok: false, message: "page와 position은 필수입니다." });
    }

    let imageUrl = null;

    if (file) {
      // ✅ 업로드 폴더: public/uploads/manager_ad
      //    정적 서빙: app.use("/uploads", express.static("public/uploads"))
      //    최종 URL: /uploads/manager_ad/파일명
      imageUrl = `/uploads/manager_ad/${file.filename}`;
    }

    const sql = `
      INSERT INTO admin_ad_slots (
        page,
        position,
        slot_type,
        image_url,
        link_url,
        text_content
      )
      VALUES ($1, $2, 'banner', $3, $4, NULL)
      ON CONFLICT (page, position)
      DO UPDATE SET
        slot_type    = 'banner',
        image_url    = EXCLUDED.image_url,
        link_url     = EXCLUDED.link_url,
        text_content = NULL,
        updated_at   = NOW()
      RETURNING id;
    `;

    const result = await pool.query(sql, [
      page,
      position,
      imageUrl,
      link_url || null,
    ]);

    return res.json({ ok: true, id: result.rows[0].id });
  } catch (err) {
    console.error("saveBannerSlot ERROR:", err);
    return res.status(500).json({
      ok: false,
      message: "배너 저장 중 서버 오류",
      error: err.message,
    });
  }
}

/**
 * 텍스트 슬롯 저장
 * POST /index/ad/text/save
 * JSON: { page, position, content }
 */
export async function saveTextSlot(req, res) {
  try {
    const { page, position, content } = req.body;

    if (!page || !position) {
      return res.status(400).json({
        ok: false,
        message: "page, position은 필수입니다.",
      });
    }

    const sql = `
      INSERT INTO admin_ad_slots (
        page,
        position,
        slot_type,
        image_url,
        link_url,
        text_content
      )
      VALUES ($1, $2, 'text', NULL, NULL, $3)
      ON CONFLICT (page, position)
      DO UPDATE SET
        slot_type    = 'text',
        image_url    = NULL,
        link_url     = NULL,
        text_content = EXCLUDED.text_content,
        updated_at   = NOW()
      RETURNING id;
    `;

    const result = await pool.query(sql, [page, position, content || ""]);

    return res.json({ ok: true, id: result.rows[0].id });
  } catch (err) {
    console.error("saveTextSlot ERROR:", err);
    return res.status(500).json({
      ok: false,
      message: "텍스트 저장 중 서버 오류",
      error: err.message,
    });
  }
}

/**
 * 배너/슬롯 조회
 * GET /index/ad/slot?page=index&position=xxx
 */
export async function getSlot(req, res) {
  try {
    const { page, position } = req.query;

    if (!page || !position) {
      return res.json({ ok: false, slot: null });
    }

    const sql = `
      SELECT id, page, position, slot_type,
             image_url, link_url, text_content,
             created_at, updated_at
      FROM admin_ad_slots
      WHERE page = $1 AND position = $2
      LIMIT 1;
    `;

    const result = await pool.query(sql, [page, position]);
    return res.json({ ok: true, slot: result.rows[0] || null });
  } catch (err) {
    console.error("getSlot ERROR:", err);
    return res.json({ ok: false, slot: null });
  }
}

/**
 * 텍스트 슬롯 조회
 * GET /index/ad/text?page=index&position=xxx
 */
export async function getTextSlot(req, res) {
  try {
    const { page, position } = req.query;

    if (!page || !position) {
      return res.json({ ok: false, text: null });
    }

    const sql = `
      SELECT id, page, position,
             text_content AS content,
             created_at, updated_at
      FROM admin_ad_slots
      WHERE page = $1 AND position = $2
        AND slot_type = 'text'
      LIMIT 1;
    `;

    const result = await pool.query(sql, [page, position]);
    return res.json({ ok: true, text: result.rows[0] || null });
  } catch (err) {
    console.error("getTextSlot ERROR:", err);
    return res.json({ ok: false, text: null });
  }
}
