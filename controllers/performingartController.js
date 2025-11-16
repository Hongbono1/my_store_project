import pool from "../db.js";

export async function getAllPerformingArts(req, res) {
  try {
    const result = await pool.query(
      `SELECT id, type, title, start_date, end_date, venue, price, main_img, created_at 
       FROM performing_arts 
       ORDER BY created_at DESC`
    );

    return res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("PERFORMING ART LIST ERROR:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
