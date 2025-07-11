// controllers/restaurantController.js
import { pool } from "../db/pool.js";

/**
 * ▣ 카테고리별 레스토랑 가게 목록
 * GET /restaurant/:category/stores
 */
export async function getStoresByCategory(req, res) {
    const { category } = req.params;

    try {
        const { rows } = await pool.query(`
      SELECT
        id,
        business_name AS "businessName",
        phone_number  AS phone,
        COALESCE(image1, '') AS thumb,
        business_category AS category
      FROM store_info
      WHERE business_category = $1
      ORDER BY id DESC
      LIMIT 8
    `, [category]);

        res.json(rows);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "카테고리별 가게 조회 오류" });
    }
}

