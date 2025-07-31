// controllers/artController.js
import { pool } from "../db/pool.js";

/* ───────── 유틸 ───────── */
const clamp = (s, n) => (typeof s === "string" && s.length > n ? s.slice(0, n) : s);

/* ───────── 1. 등록 ───────── */
export async function registerArt(req, res) {
  try {
    const {
      category, title, start_date, end_date, time, venue, address, description,
      price, host, age_limit, capacity, tags,
      social1, social2, social3, booking_url, phone, type
    } = req.body;

    /* 이미지 경로 */
    const imgPath = (f) => (f ? `/uploads/${f.filename}` : null);
    const image1 = imgPath(req.files?.images?.[0]);
    const image2 = imgPath(req.files?.images?.[1]);
    const image3 = imgPath(req.files?.images?.[2]);
    const pamphlet = JSON.stringify((req.files?.pamphlet || []).map(imgPath));

    const result = await pool.query(
      `INSERT INTO art_info (
        category, title, start_date, end_date, time, venue, address, description,
        price, host, age_limit, capacity, tags,
        social1, social2, social3, booking_url, phone,
        image1, image2, image3, pamphlet, type
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,
        $14,$15,$16,$17,$18,
        $19,$20,$21,$22,$23
      ) RETURNING *`,
      [
        category, title, start_date, end_date, clamp(time, 50), venue, address, description,
        price, host, age_limit, capacity, tags,
        social1, social2, social3, booking_url, clamp(phone, 20),
        image1, image2, image3, pamphlet, type
      ]
    );
    res.json({ success: true, id: result.rows[0]?.id, art: result.rows[0] });
  } catch (err) {
    console.error("[registerArt]", err);
    res.status(500).json({ success: false, error: err.message });
  }
}

/* ───────── 2. 전체 리스트(옵션) ───────── */
export async function getArtList(req, res) {
  try {
    const { category } = req.query;
    let sql = "SELECT * FROM art_info";
    let params = [];

    if (category) {
      sql += `
        WHERE  TRIM(LOWER(type))     = TRIM(LOWER($1))
        OR     $1 = ANY(category)
      `;
      params = [category];
    }
    sql += " ORDER BY created_at DESC NULLS LAST, id DESC";

    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error("[getArtList]", err);
    res.status(500).json({ success: false, error: err.message });
  }
}

/* ───────── 3. 카테고리별 리스트 ───────── */
// controllers/artController.js (수정 부분만)
export async function getArtListByCategory(req, res, category) {
  try {
    const result = await pool.query(
      `
      SELECT *
      FROM art_info
      WHERE TRIM(LOWER(category)) = TRIM(LOWER($1))
         OR TRIM(LOWER(type))     = TRIM(LOWER($1))
      ORDER BY created_at DESC NULLS LAST, id DESC
      `,
      [category]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("[getArtListByCategory]", err);
    res.status(500).json({ success: false, error: err.message });
  }
}


/* ───────── 4. 상세 ───────── */
export async function getArtById(req, res) {
  try {
    const { id } = req.params;
    const result = await pool.query("SELECT * FROM art_info WHERE id = $1", [id]);
    if (!result.rowCount) return res.status(404).json({ success: false, error: "Not found" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error("[getArtById]", err);
    res.status(500).json({ success: false, error: err.message });
  }
}
