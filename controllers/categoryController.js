// ✅ controllers/categoryController.js
import { pool } from "../db/pool.js";

// 카테고리 리스트
export async function getCategories(req, res) {
  try {
    res.json(["식사", "분식", "카페"]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "서버 오류" });
  }
}

// 카테고리별 가게 목록
export async function getStoresByCategory(req, res) {
  // 라우트 파라미터를 우선으로, 없으면 쿼리 스트링 사용
  const category = req.params.category || req.query.category || "";
  console.log("🛠️ getStoresByCategory called with category:", category);

  try {
    const { rows } = await pool.query(
      `
      SELECT
        id,
        business_name        AS "businessName",
        business_category    AS "businessType",
        business_subcategory AS "category",
        phone_number         AS "phone",
        image1               AS "thumbnailUrl",
        power_ad             AS "powerAd"
      FROM store_info
      WHERE ($1 = '' OR business_category = $1)
      `,
      [category]
    );

    console.log("🛠️ getStoresByCategory result:", rows);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "서버 오류" });
  }
}
