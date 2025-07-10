// controllers/subcategoryController.js
import { pool } from "../db/pool.js";

/**
 * ▣ 서브카테고리별 가게 목록
 * GET /subcategory/:sub/stores
 */
// 완성형 예시
export async function getStoresBySubcategory(req, res) {
  const { sub } = req.params;  // ex) '밥'
  try {
    const sql = `
      SELECT
        id,
        business_name         AS "businessName",
        phone_number          AS "phone",
        COALESCE(image1,'')   AS "thumb",
        business_category     AS "category",
        business_subcategory  AS "subcategory"
      FROM store_info
      WHERE business_subcategory = $1
      ORDER BY id DESC
    `;
    const { rows } = await pool.query(sql, [sub]);
    res.json(rows);
  } catch (err) {
    console.error("getStoresBySubcategory ▶", err);
    res.status(500).json({ error: "서브카테고리별 가게 조회 오류" });
  }
}

