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

// ✅ 카테고리별 가게 목록
export async function getStoresByCategory(req, res) {
  const { category } = req.query;

  try {
    const { rows } = await pool.query(
      `
       SELECT
        id,
        business_name    AS "businessName",
        business_type    AS "businessType",     -- 대분류
        business_subcategory AS "subcategory",  -- 소분류
        phone_number     AS "phone",
        image1           AS "thumbnailUrl",     -- 프론트에서 기대하는 이름
        power_ad         AS "powerAd"           -- 파워광고 여부
      FROM store_info
      WHERE ($1 = '' OR business_type = $1)      -- 필요하다면 대분류 필터
        AND ($2 = '' OR business_subcategory = $2) -- 소분류 필터(프론트에서 subcategory 파라미터 넘길 때)
      `,
      [category]
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "서버 오류" });
  }
}
