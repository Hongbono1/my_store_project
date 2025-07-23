import { pool } from "../db/pool.js";

/**
 * ▣ 파워 광고 목록
 * GET /restaurant/ads
 */
export async function getPowerAds(req, res) { 
  return res.json([]); // 임시로 빈 배열 반환
  console.log("▶ getPowerAds 호출됨");
  try {
    const { rows } = await pool.query(`
      SELECT
        id,
        business_name      AS "businessName",
        business_category  AS "category",
        phone_number       AS "phone",
        '/uploads/' || image1 AS "thumb"
      FROM store_info
      WHERE is_power_ad = true
      ORDER BY created_at DESC
      LIMIT 4;
    `);
    res.json(rows);
  } catch (err) {
    console.error("파워광고 조회 오류:", err);
    res.status(500).json({ error: "파워광고 조회 오류" });
  }
}

/**
 * ▣ 카테고리별 레스토랑 가게 목록
 * GET /restaurant/:category/stores
 */
export async function getStoresByCategory(req, res) {
  const { category } = req.params;
  try {
    const { rows } = await pool.query(
      `
      SELECT
        id,
        business_name      AS title,
        business_category  AS category,
        phone_number       AS phone,
        -- image1에 'uploads/파일.jpg' 형식으로만 저장되어 있다고 가정
        -- 만약 image1에 앞에 슬래시가 붙어 있으면 제거
        CASE 
          WHEN image1 LIKE '/%' 
            THEN image1 
          ELSE '/uploads/' || image1 
        END AS img
      FROM store_info
      WHERE business_category = $1
      ORDER BY view_count DESC
      LIMIT 20
      `,
      [category]
    );

    res.json(rows);
  } catch (e) {
    console.error("가게 목록 조회 중 에러:", e);
    res.status(500).json({ error: "가게 목록 조회 실패" });
  }
}
