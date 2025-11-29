// controllers/hotController.js
import pool from "../db.js";

/** GET /api/suggest?mood=... */
export async function getSuggest(req, res) {
  const raw = (req.query.mood || "").toString().trim().toLowerCase();
  const isAll = !raw || raw === "all" || raw === "전체";

  try {
    let rows = [];

    // 1) menus 테이블 먼저 시도
    try {
      if (isAll) {
        const r = await pool.query(
          `SELECT
             id,
             store_id,
             menu_name      AS name,
             menu_image     AS image_url,
             menu_desc,
             mood,
             store_name
           FROM menus
           ORDER BY id DESC
           LIMIT 100`
        );
        rows = r.rows || [];
      } else {
        const r = await pool.query(
          `SELECT
             id,
             store_id,
             menu_name      AS name,
             menu_image     AS image_url,
             menu_desc,
             mood,
             store_name
           FROM menus
           WHERE lower(mood) = $1
              OR menu_name ILIKE $2
              OR menu_desc ILIKE $2
           ORDER BY id DESC
           LIMIT 100`,
          [raw, `%${raw}%`]
        );
        rows = r.rows || [];
      }
    } catch (err) {
      console.warn("[getSuggest] menus query failed, fallback to hotblogs:", err?.message || err);
      rows = [];
    }

    // 2) menus 결과가 없으면 hotblogs 폴백
    if (!rows || rows.length === 0) {
      if (isAll) {
        const r2 = await pool.query(
          `SELECT
             id,
             id            AS store_id,
             title         AS name,
             cover_image   AS image_url,
             ''            AS menu_desc,
             qa_mode       AS mood,
             store_name
           FROM hotblogs
           ORDER BY created_at DESC
           LIMIT 100`
        );
        rows = r2.rows || [];
      } else {
        const r2 = await pool.query(
          `SELECT
             id,
             id            AS store_id,
             title         AS name,
             cover_image   AS image_url,
             ''            AS menu_desc,
             qa_mode       AS mood,
             store_name
           FROM hotblogs
           WHERE lower(qa_mode) = $1
              OR lower(category) = $1
              OR title ILIKE $2
           ORDER BY created_at DESC
           LIMIT 100`,
          [raw, `%${raw}%`]
        );
        rows = r2.rows || [];
      }
    }

    return res.json({ ok: true, data: rows });
  } catch (err) {
    console.error("[getSuggest] unexpected error:", err?.message || err);
    return res
      .status(500)
      .json({ ok: false, error: "db_error", detail: String(err?.message || err) });
  }
}

export default { getSuggest };
