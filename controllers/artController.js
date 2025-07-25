// controllers/artController.js
import pool from '../db.js';

export async function registerArt(req, res) {
  try {
    const {
      type, title, start_date, end_date, time, venue, address, description,
      price, host, age_limit, capacity, tags,
      social1, social2, social3, booking_url, phone
    } = req.body;

    const image1 = req.files?.images?.[0]?.filename || null;
    const image2 = req.files?.images?.[1]?.filename || null;
    const image3 = req.files?.images?.[2]?.filename || null;

    const result = await pool.query(
      `INSERT INTO art_info (
        type, title, start_date, end_date, time, venue, address, description,
        price, host, age_limit, capacity, tags,
        social1, social2, social3, booking_url, phone,
        image1, image2, image3
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21
      )
      RETURNING *`,
      [
        type, title, start_date, end_date, time, venue, address, description,
        price, host, age_limit, capacity ? Number(capacity) : null, tags,
        social1, social2, social3, booking_url, phone,
        image1, image2, image3
      ]
    );

    res.json({ success: true, art: result.rows[0] });
  } catch (err) {
    console.error('[registerArt] ', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

export async function getArtList(req, res) {
  try {
    const result = await pool.query("SELECT * FROM art_info ORDER BY created_at DESC");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

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
