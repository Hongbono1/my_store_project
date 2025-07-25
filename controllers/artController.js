import pool from '../db.js';

// 공연/예술/축제/버스커 등록 (팜플렛 포함)
export async function registerArt(req, res) {
  try {
    const {
      type, title, start_date, end_date, time, venue, address, description,
      price, host, age_limit, capacity, tags,
      social1, social2, social3, booking_url, phone
    } = req.body;

    // 이미지 업로드 (최대 3장)
    const image1 = req.files?.images?.[0]?.filename || null;
    const image2 = req.files?.images?.[1]?.filename || null;
    const image3 = req.files?.images?.[2]?.filename || null;

    // 팜플렛 업로드 (1개, 이미지 or PDF)
    const pamphlet = req.files?.pamphlet?.[0]?.filename || null;

    const result = await pool.query(
      `INSERT INTO art_info (
        type, title, start_date, end_date, time, venue, address, description,
        price, host, age_limit, capacity, tags,
        social1, social2, social3, booking_url, phone,
        image1, image2, image3, pamphlet
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22
      )
      RETURNING *`,
      [
        type, title, start_date, end_date, time, venue, address, description,
        price, host, age_limit, capacity ? Number(capacity) : null, tags,
        social1, social2, social3, booking_url, phone,
        image1, image2, image3, pamphlet
      ]
    );

    // 프론트에서 result.rows[0].id 바로 쓰게 편의성 맞춤
    res.json({ success: true, id: result.rows[0]?.id, art: result.rows[0] });
  } catch (err) {
    console.error('[registerArt] ', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

// 전체 리스트 조회
export async function getArtList(req, res) {
  try {
    const result = await pool.query("SELECT * FROM art_info ORDER BY created_at DESC");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// ID로 상세 조회
export async function getArtById(req, res) {
  try {
    const id = req.params.id;
    const result = await pool.query("SELECT * FROM art_info WHERE id = $1", [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}
