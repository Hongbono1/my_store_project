// controllers/subcategoryController.js
import { pool } from "../db/pool.js";

/**
 * ▣ 서브카테고리별 가게 목록
 * GET /subcategory/:sub/stores
 * 
 * URL 파라미터:
 *   sub = '밥' 등 store_menu.category 에 저장된 값
 */
export async function getStoresBySubcategory(req, res) {
  const { sub } = req.params;  // ex) '밥'

  try {
    const sql = `
      SELECT s.id,
             s.business_name      AS "businessName",
             s.phone_number       AS "phone",
             COALESCE(s.image1, '') AS "thumb",
             s.business_category    AS "category",
             m.category             AS "subcategory"
      FROM   store_info s
      JOIN   store_menu m
        ON   m.store_id = s.id
      WHERE  m.category = $1
      GROUP  BY s.id, s.business_name, s.phone_number, s.image1, s.business_category, m.category
      ORDER  BY s.id DESC
    `;
    const { rows } = await pool.query(sql, [sub]);
    res.json(rows);
  } catch (err) {
    console.error("getStoresBySubcategory ▶", err);
    res.status(500).json({ error: "서브카테고리별 가게 조회 오류" });
  }
}
