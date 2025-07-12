import { pool } from "../db/pool.js";

/**
 * ▣ 파워 광고 목록
 * GET /restaurant/ads
 */
export async function getPowerAds(req, res) {
  try {
    const { rows } = await pool.query(`
      SELECT
        id,
        business_name      AS "businessName",
        business_category  AS "category",
        phone_number       AS "phone",
        '/uploads/' || image1 AS "thumb"
      FROM store_info
      WHERE is_power_ad = true
      ORDER BY created_at DESC
      LIMIT 4;
    `);
    res.json(rows);
  } catch (err) {
    console.error("파워광고 조회 오류:", err);
    res.status(500).json({ error: "파워광고 조회 오류" });
  }
}

/**
 * ▣ 카테고리별 레스토랑 가게 목록
 * GET /restaurant/:category/stores
 */
export async function getStoresByCategory(req, res) {
  const { category } = req.params;
  try {
    const { rows } = await pool.query(
      `
      SELECT
        id,
        business_name      AS "title",
        business_category  AS "category",
        phone_number       AS "phone",
        '/uploads/' || image1 AS "img"
      FROM store_info
      WHERE business_category = $1
      ORDER BY created_at DESC
      LIMIT  100
      `,
      [category]
    );
    res.json(rows);
  } catch (err) {
    console.error("카테고리별 가게 조회 오류:", err);
    res.status(500).json({ error: "카테고리별 가게 조회 오류" });
  }
}
