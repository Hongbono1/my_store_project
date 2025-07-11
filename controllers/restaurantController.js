// controllers/restaurantController.js
import { pool } from "../db/pool.js";

/**
 * ▣ 카테고리별 레스토랑 가게 목록
 * GET /restaurant/:category/stores
 */
export async function getStoresByCategory(req, res) {
    const { category } = req.params;

    const sql = `
    SELECT
      id,
      business_name AS "businessName",
      phone_number  AS "phone",
      COALESCE(image1,'') AS "thumb",
      business_category AS "category"
    FROM store_info
    WHERE business_type = '레스토랑'
      AND business_category = $1
    ORDER BY id DESC
  `;

    try {
        const { rows } = await pool.query(sql, [category]);
        console.log("[레스토랑] category:", category, " rows:", rows.length);
        res.json(rows);
    } catch (err) {
        console.error("[레스토랑] DB 조회 오류:", err);
        res.status(500).json({ error: "DB error" });
    }
}
