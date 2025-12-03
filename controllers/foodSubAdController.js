// controllers/foodSubAdController.js
import pool from "../db.js";

/**
 * /api/subcategory/:type
 *  - /api/subcategory/food?category=분식
 *  - /api/subcategory/beauty?category=네일
 */
export async function getFoodSubcategoryStores(req, res) {
  const { type } = req.params;               // food, beauty ...
  const category = req.query.category || ""; // 한식, 분식, 양식 등

  const t = String(type || "").toLowerCase();

  // 허용되는 type
  const ALLOWED = ["food", "beauty"];
  if (!ALLOWED.includes(t)) {
    return res.status(400).json({
      ok: false,
      error: "invalid_type",
      message: `지원하지 않는 type 입니다. (허용: ${ALLOWED.join(", ")})`,
    });
  }

  // ✅ 실제 네온 DB 구조에 맞춰서 이 부분만 한 번 확인해 줘
  // 예시: combined_store_info 테이블을 사용한다고 가정
  //
  // columns 예시:
  //  - id
  //  - business_name
  //  - business_category
  //  - business_type
  //  - image_url / main_image_url / thumbnail_url
  //
  // 실제 컬럼 이름이 다르면 SELECT 부분만 수정하면 됨
  let sql = `
    SELECT
      id,
      business_name,
      business_category,
      business_type,
      image_url,
      main_image_url,
      thumbnail_url,
      created_at
    FROM combined_store_info
    WHERE 1=1
  `;
  const params = [];

  // type → business_type 매핑 (필요하면 수정)
  if (t === "food") {
    sql += ` AND business_type = '음식점'`;
  } else if (t === "beauty") {
    sql += ` AND business_type = '미용'`;
  }

  // 카테고리(분식, 한식, 양식...) 필터
  if (category) {
    params.push(category);
    sql += ` AND business_category = $${params.length}`;
  }

  sql += ` ORDER BY created_at DESC NULLS LAST`;

  try {
    const result = await pool.query(sql, params);

    const stores = result.rows.map((row) => {
      const img =
        row.image_url ||
        row.main_image_url ||
        row.thumbnail_url ||
        "/uploads/no-image.png";

      return {
        id: row.id,

        // 이름 관련 필드 여러 개 채워주기 (프론트에서 어떤 키를 써도 되게)
        name: row.business_name,
        business_name: row.business_name,

        // 카테고리/타입도 공통 키로 맞춰주기
        business_category: row.business_category,
        business_type: row.business_type,
        category: row.business_category,
        type: row.business_type,

        // 이미지 관련
        image: img,
        image_url: img,
      };
    });

    return res.json({
      ok: true,
      type: t,
      category,
      count: stores.length,
      stores,
    });
  } catch (err) {
    console.error("❌ getFoodSubcategoryStores ERROR:", err);
    return res.status(500).json({
      ok: false,
      error: "server_error",
      message: "서브 카테고리 데이터를 불러오는 중 오류가 발생했습니다.",
    });
  }
}
