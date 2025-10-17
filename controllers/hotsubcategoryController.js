import pool from "../db.js";

/* =========================================================
   📘 핫 서브카테고리 - 오늘의 테마 목록 조회
   ========================================================= */
export async function getHotSubTheme(req, res) {
  try {
    const result = await pool.query(`
      SELECT 
        id, title, store_name AS store, category, qa_mode, 
        thumbnail AS img, short_desc AS desc, rating, created_at
      FROM hotblog
      WHERE qa_mode = 'theme'
      ORDER BY created_at DESC
      LIMIT 30
    `);
    res.json({ ok: true, data: result.rows });
  } catch (err) {
    console.error("🔥 getHotSubTheme Error:", err);
    res.status(500).json({ ok: false, error: "서버 오류" });
  }
}
