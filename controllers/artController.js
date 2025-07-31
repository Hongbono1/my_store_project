// controllers/artController.js
import { pool } from "../db/pool.js";

// 긴 문자열 자르기(보호용)
const clamp = (s, n) => (typeof s === "string" && s.length > n ? s.slice(0, n) : s);

// 등록
export async function registerArt(req, res) {
  console.log('DEBUG req.body:', req.body);
  try {
    const {
      category, title, start_date, end_date, time, venue, address, description,
      price, host, age_limit, capacity, tags,
      social1, social2, social3, booking_url, phone, type
    } = req.body;

    // 이미지 경로
    const image1 = req.files?.images?.[0]?.filename ? `/uploads/${req.files.images[0].filename}` : null;
    const image2 = req.files?.images?.[1]?.filename ? `/uploads/${req.files.images[1].filename}` : null;
    const image3 = req.files?.images?.[2]?.filename ? `/uploads/${req.files.images[2].filename}` : null;
    const pamphletFiles = (req.files?.pamphlet || []).map(f => `/uploads/${f.filename}`);
    const pamphlet = JSON.stringify(pamphletFiles);

    const phoneSafe = clamp(phone, 20);
    const timeSafe = clamp(time, 50);

    const result = await pool.query(
      `INSERT INTO art_info (
        category, title, start_date, end_date, time, venue, address, description,
        price, host, age_limit, capacity, tags,
        social1, social2, social3, booking_url, phone,
        image1, image2, image3, pamphlet, type
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,
        $19,$20,$21,$22,$23
      ) RETURNING *`,
      [
        category, title, start_date, end_date, timeSafe, venue, address, description,
        price, host, age_limit, capacity, tags,
        social1, social2, social3, booking_url, phoneSafe,
        image1, image2, image3, pamphlet, type
      ]
    );
    res.json({ success: true, id: result.rows[0]?.id, art: result.rows[0] });
  } catch (err) {
    console.error("[registerArt]", err);
    res.status(500).json({ success: false, error: err.message });
  }
}

// 리스트: category와 type 모두 대응!
export async function getArtList(req, res) {
  try {
    const { category } = req.query;
    let sql = "SELECT * FROM art_info";
    let params = [];

    if (category) {
      sql += `
        WHERE (category ILIKE '%"${category}"%'
               OR TRIM(LOWER(type)) = TRIM(LOWER($1)))
      `;
      params = [category];
    }
    sql += " ORDER BY created_at DESC NULLS LAST, id DESC";
    console.log("[getArtList] sql:", sql, "params:", params);

    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error("[getArtList]", err);
    res.status(500).json({ success: false, error: err.message });
  }
}


// 상세
export async function getArtById(req, res) {
  try {
    const id = req.params.id;
    const result = await pool.query("SELECT * FROM art_info WHERE id = $1", [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("[getArtById]", err);
    res.status(500).json({ success: false, error: err.message });
  }
}
