import { pool } from "../db/pool.js";

/**
 * ▣ 가장 핫한 우리동네 목록 조회 (search+view+click 합산)
 * GET /hot/api
 */
export async function getHotStores(req, res) {
  try {
    const sql = `
      SELECT
        id,
        business_name   AS "businessName",
        phone_number    AS "phone",
        COALESCE(image1, '') AS "thumb",
        (COALESCE(search_count,0) + COALESCE(view_count,0) + COALESCE(click_count,0)) AS total_count
      FROM store_info
      ORDER BY total_count DESC
      LIMIT 8;
    `;
    const { rows } = await pool.query(sql);
    res.json(rows);
  } catch (err) {
    console.error("❌ [핫 스토어 조회] 오류 ▶", err);
    res.status(500).json({ error: "핫 스토어 조회 실패" });
  }
}
