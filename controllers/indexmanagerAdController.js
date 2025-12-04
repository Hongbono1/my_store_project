// controllers/indexmanagerAdController.js
import pool from "../db.js";

/**
 * GET /manager/ad/slot?page=index&position=index_main_top
 * 인덱스 메인에서 이미지/링크 로딩
 */
export async function getSlot(req, res) {
  const page = (req.query.page || "").trim();
  const position = (req.query.position || "").trim();

  if (!page || !position) {
    return res.status(400).json({ ok: false, message: "page, position 필수" });
  }

  try {
    const { rows } = await pool.query(
      `
      SELECT *
      FROM admin_ad_slots
      WHERE page = $1 AND position = $2
      ORDER BY updated_at DESC
      LIMIT 1
      `,
      [page, position]
    );

    if (rows.length === 0) {
      return res.json({ ok: true, slot: null });
    }

    return res.json({ ok: true, slot: rows[0] });
  } catch (err) {
    console.error("getSlot error:", err);
    return res.status(500).json({ ok: false, message: "slot 조회 오류" });
  }
}

/**
 * POST /manager/ad/upload
 * multipart/form-data
 * fields: page, position, link_url, start_date, end_date, start_time, end_time
 * file: image
 */
export async function uploadSlot(req, res) {
  const page = (req.body.page || "").trim();
  const position = (req.body.position || "").trim();
  const linkUrl = (req.body.link_url || "").trim() || null;
  const startDate = req.body.start_date || null;
  const endDate = req.body.end_date || null;
  const startTime = req.body.start_time || null;
  const endTime = req.body.end_time || null;

  if (!page || !position) {
    return res.status(400).json({ ok: false, message: "page, position 필수" });
  }

  let imageUrl = null;
  if (req.file) {
    // /uploads → public/uploads 정적 서빙 가정
    imageUrl = `/uploads/${req.file.filename}`;
  }

  try {
    const params = [
      page,
      position,
      imageUrl,
      linkUrl,
      startDate,
      endDate,
      startTime,
      endTime,
    ];

    const query = `
      INSERT INTO admin_ad_slots
        (page, position, image_url, link_url, start_date, end_date, start_time, end_time)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (page, position)
      DO UPDATE SET
        image_url = COALESCE(EXCLUDED.image_url, admin_ad_slots.image_url),
        link_url = EXCLUDED.link_url,
        start_date = EXCLUDED.start_date,
        end_date = EXCLUDED.end_date,
        start_time = EXCLUDED.start_time,
        end_time = EXCLUDED.end_time,
        updated_at = NOW()
      RETURNING *;
    `;

    const { rows } = await pool.query(query, params);
    return res.json({ ok: true, slot: rows[0] });
  } catch (err) {
    console.error("uploadSlot error:", err);
    return res.status(500).json({ ok: false, message: "slot 저장 오류" });
  }
}

/**
 * POST /manager/ad/store
 * body: { page, position, biz_number, biz_name, start_date, end_date, start_time, end_time }
 * 지금 단계에서는 “가게 DB에서 찾아 자동 링크”가 아니라
 * 우선 슬롯에 biz_number, biz_name + 기간만 저장하는 구조.
 * 나중에 스토어 DB랑 연동할 때 이 부분만 확장하면 됨.
 */
export async function linkStoreSlot(req, res) {
  const page = (req.body.page || "").trim();
  const position = (req.body.position || "").trim();
  const bizNumber = (req.body.biz_number || "").trim();
  const bizName = (req.body.biz_name || "").trim();
  const startDate = req.body.start_date || null;
  const endDate = req.body.end_date || null;
  const startTime = req.body.start_time || null;
  const endTime = req.body.end_time || null;

  if (!page || !position) {
    return res.status(400).json({ ok: false, message: "page, position 필수" });
  }
  if (!bizNumber || !bizName) {
    return res.status(400).json({ ok: false, message: "사업자번호, 상호 필수" });
  }

  try {
    const params = [
      page,
      position,
      bizNumber,
      bizName,
      startDate,
      endDate,
      startTime,
      endTime,
    ];

    const query = `
      INSERT INTO admin_ad_slots
        (page, position, biz_number, biz_name, start_date, end_date, start_time, end_time)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (page, position)
      DO UPDATE SET
        biz_number = EXCLUDED.biz_number,
        biz_name = EXCLUDED.biz_name,
        start_date = EXCLUDED.start_date,
        end_date = EXCLUDED.end_date,
        start_time = EXCLUDED.start_time,
        end_time = EXCLUDED.end_time,
        updated_at = NOW()
      RETURNING *;
    `;

    const { rows } = await pool.query(query, params);
    return res.json({ ok: true, slot: rows[0] });
  } catch (err) {
    console.error("linkStoreSlot error:", err);
    return res.status(500).json({ ok: false, message: "가게 연결 슬롯 저장 오류" });
  }
}

/**
 * GET /manager/ad/text/get?page=index&position=index_sub_keywords
 */
export async function getTextSlot(req, res) {
  const page = (req.query.page || "").trim();
  const position = (req.query.position || "").trim();

  if (!page || !position) {
    return res.status(400).json({ ok: false, message: "page, position 필수" });
  }

  try {
    const { rows } = await pool.query(
      `
      SELECT *
      FROM admin_text_slots
      WHERE page = $1 AND position = $2
      ORDER BY updated_at DESC
      LIMIT 1
      `,
      [page, position]
    );

    if (rows.length === 0) {
      return res.json({ ok: true, text: null });
    }

    return res.json({ ok: true, text: rows[0] });
  } catch (err) {
    console.error("getTextSlot error:", err);
    return res.status(500).json({ ok: false, message: "텍스트 슬롯 조회 오류" });
  }
}

/**
 * POST /manager/ad/text/save
 * body: { page, position, content }
 */
export async function saveTextSlot(req, res) {
  const page = (req.body.page || "").trim();
  const position = (req.body.position || "").trim();
  const content = (req.body.content || "").trim();

  if (!page || !position || !content) {
    return res.status(400).json({ ok: false, message: "page, position, content 필수" });
  }

  try {
    const { rows } = await pool.query(
      `
      INSERT INTO admin_text_slots (page, position, content)
      VALUES ($1, $2, $3)
      ON CONFLICT (page, position)
      DO UPDATE SET
        content = EXCLUDED.content,
        updated_at = NOW()
      RETURNING *;
      `,
      [page, position, content]
    );

    return res.json({ ok: true, text: rows[0] });
  } catch (err) {
    console.error("saveTextSlot error:", err);
    return res.status(500).json({ ok: false, message: "텍스트 슬롯 저장 오류" });
  }
}

export default {
  getSlot,
  uploadSlot,
  linkStoreSlot,
  getTextSlot,
  saveTextSlot,
};
