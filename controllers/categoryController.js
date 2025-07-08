// controllers/categoryController.js
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
  // 라우트 파라미터 또는 쿼리 스트링에서 category를 가져옵니다.
  const category = req.params.category || req.query.category || "";
  console.log("🛠️ getStoresByCategory called with category:", category);

  try {
    const sql = `
      SELECT
        id,
        business_name        AS "businessName",    -- 가게 이름
        business_category    AS "businessType",    -- 대분류 (예: 한식)
        business_subcategory AS "category",        -- 소분류 (예: 밥, 찌개/탕)
        phone_number         AS "phone",           -- 전화번호
        image1               AS "thumbnailUrl",    -- 썸네일 이미지 URL
        power_ad             AS "powerAd"          -- 파워광고 여부 (boolean)
      FROM store_info
      WHERE ($1 = '' OR business_category = $1)
    `;
    const { rows } = await pool.query(sql, [category]);
    console.log("🛠️ getStoresByCategory result:", rows.length, "rows");
    return res.json(rows);

  } catch (err) {
    console.error("🔴 getStoresByCategory error:", err);
    return res
      .status(500)
      .json({
        error: err.message,
        stack: err.stack.split("\n").slice(0, 3)
      });
  }
}
