import pool from "../db.js";

/** 오늘의 테마용 핫서브 데이터 반환 */
export async function getHotSubTheme(req, res) {
  try {
    const q = `
      SELECT id, title, store_name, category, cover_image, phone, url, address, qa_mode, created_at
      FROM hotblogs
      WHERE qa_mode = 'theme' OR category = 'theme'
      ORDER BY created_at DESC
      LIMIT 50
    `;
    const { rows } = await pool.query(q);
    return res.json({ ok: true, blogs: rows });
  } catch (err) {
    console.error("[getHotSubTheme] error", err);
    return res.status(500).json({ ok: false, error: "internal" });
  }
}

export default { getHotSubTheme };
