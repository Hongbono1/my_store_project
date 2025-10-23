import pool from "../db.js";

/** GET /api/suggest?mood=... */
export async function getSuggest(req, res) {
  const mood = (req.query.mood || "all").toString().trim().toLowerCase();

  try {
    // 1) 우선 menus 테이블 시도
    let sql, params;
    if (mood === "all") {
      sql = `SELECT id, store_id, menu_name, menu_image, menu_desc, mood, store_name FROM menus ORDER BY id DESC LIMIT 100`;
      params = [];
    } else {
      sql = `SELECT id, store_id, menu_name, menu_image, menu_desc, mood, store_name
             FROM menus
             WHERE lower(mood) = $1 OR menu_name ILIKE $2 OR menu_desc ILIKE $2
             ORDER BY id DESC LIMIT 100`;
      params = [mood, `%${mood}%`];
    }

    let { rows } = await pool.query(sql, params);

    // 2) menus 결과 없거나 테이블이 없으면 hotblogs 폴백
    if (!rows || rows.length === 0) {
      const qb = mood === "all"
        ? `SELECT id, id AS store_id, title AS menu_name, cover_image AS menu_image, '' AS menu_desc, qa_mode AS mood, store_name FROM hotblogs ORDER BY created_at DESC LIMIT 100`
        : `SELECT id, id AS store_id, title AS menu_name, cover_image AS menu_image, '' AS menu_desc, qa_mode AS mood, store_name
           FROM hotblogs
           WHERE lower(qa_mode) = $1 OR lower(category) = $1 OR title ILIKE $2
           ORDER BY created_at DESC LIMIT 100`;
      const qparams = mood === "all" ? [] : [mood, `%${mood}%`];
      const r2 = await pool.query(qb, qparams);
      rows = r2.rows || [];
    }

    return res.json({ ok: true, data: rows });
  } catch (err) {
    console.error("[getSuggest] error:", err && err.message ? err.message : err);
    // 디버깅용 detail 반환(운영시 삭제 권장)
    return res.status(500).json({ ok: false, error: "db_error", detail: String(err?.message || err) });
  }
}

export default { getSuggest };
