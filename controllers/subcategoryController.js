// controllers/subcategoryController.js
import { pool } from "../db/pool.js";

/**
 * ▣ 서브카테고리별 가게 목록
 * GET /subcategory/:sub/stores
 */
export async function getStoresBySubcategory(req, res) {
  const { sub } = req.params;  // ex) '밥'

  const sql = `
    SELECT
      id,
      business_name AS "businessName",
      phone_number  AS "phone",
      COALESCE(image1,'') AS "thumb",
      business_category AS "category",
      business_subcategory AS "subcategory"
    FROM store_info
    WHERE business_subcategory = $1   -- ✅ 이 컬럼으로 조회
    ORDER BY id DESC
  `;

  try {
    const { rows } = await pool.query(sql, [sub]);
    console.log("✅ [서브카테고리] 결과 rows ▶", rows);   // 서버 터미널에 찍혀서 데이터 확인 가능
    res.json(rows);
  } catch (err) {
    console.error("❌ [서브카테고리] 조회 오류 ▶", err);
    res.status(500).json({ error: "서브카테고리 조회 실패" });
  }
}

