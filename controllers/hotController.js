import { pool } from "../db/pool.js";

/**
 * ▣ 가장 핫한 우리동네 목록 조회
 * GET /hot
 */
export async function getHotStores(req, res) {
  try {
    const sql = `
      SELECT
        id,
        business_name   AS "businessName",
        phone_number    AS "phone",
        COALESCE(image1,'') AS "thumb"
      FROM store_info
      ORDER BY hit_count DESC
      LIMIT 8;
    `;
    const { rows } = await pool.query(sql);
    res.json(rows);
  } catch (err) {
    console.error("❌ [핫 스토어 조회] 오류 ▶", err);
    res.status(500).json({ error: "핫 스토어 조회 실패" });
  }
}
