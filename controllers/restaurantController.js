// controllers/restaurantController.js
import { pool } from "../db/pool.js";

/**
 * ▣ 카테고리별 레스토랑 가게 목록
 * GET /restaurant/:category/stores
 */
export async function getStoresByRestaurant(req, res) {
  try {
    const sql = `
      SELECT
        id,
        business_name AS "businessName",
        phone_number  AS "phone",
        COALESCE(image1, '') AS "thumb",
        business_category AS "category"
      FROM store_info
      WHERE business_category = '레스토랑'
      ORDER BY id DESC
    `;
    const { rows } = await pool.query(sql);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '레스토랑 데이터 조회 오류' });
  }
}

