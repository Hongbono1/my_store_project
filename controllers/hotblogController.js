// controllers/hotblogController.js
import pool from "../db.js";

/* ================================
   🔥 HOTBLOG CONTROLLER
   ================================ */

// 전체 핫블로그 목록 가져오기
export async function getAllHotblogs(req, res) {
  try {
    const { category, limit } = req.query;
    const params = [];
    let sql = `
      SELECT id, title, cover_image, store_name, category, phone, url, address, qa_mode, created_at
      FROM hotblogs
    `;
    if (category && category !== "all") {
      sql += ` WHERE category = $1`;
      params.push(category);
    }
    sql += ` ORDER BY created_at DESC`;
    if (limit) sql += ` LIMIT ${Number(limit) || 20}`;

    const { rows } = await pool.query(sql, params);
    return res.json(rows);
  } catch (err) {
    console.error("[getAllHotblogs]", err);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
}

// 랜덤 1개 핫블로그 반환
export async function getRandomHotblog(req, res) {
  try {
    const { rows } = await pool.query(`
      SELECT id, title, cover_image, store_name, category, phone, url, address, qa_mode, created_at
      FROM hotblogs
      ORDER BY RANDOM()
      LIMIT 1
    `);
    if (rows.length === 0) return res.json({ ok: false, message: "no data" });
    return res.json({ ok: true, blog: rows[0] });
  } catch (err) {
    console.error("[getRandomHotblog]", err);
    res.status(500).json({ ok: false, error: "internal_error" });
  }
}
