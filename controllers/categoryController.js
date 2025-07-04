// controllers/categoryController.js
import { pool } from "../db/pool.js";

/** 1) 카테고리 목록 (간단 Mock) */
export async function getCategories(req, res) {
  try {
    // 필요하면 DB에서 SELECT DISTINCT business_category …
    res.json(["식사", "분식", "카페"]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "서버 오류" });
  }
}

/** 2) 특정 카테고리 이름으로 가게 목록 반환 */
export async function getStoresByCategory(req, res) {
  const { categoryName } = req.params;                // ex: '식사'

  try {
    const query = `
      SELECT
        id,
        business_name      AS "businessName",
        business_category  AS "businessCategory",
        phone_number       AS "phone",
        image1,
        address
      FROM store_info
      WHERE business_category = $1
    `;
    const { rows } = await pool.query(query, [categoryName]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "서버 오류" });
  }
}
