// controllers/subcategoryController.js
import pool from "../db.js";

/** 음식점 업종별 가게 조회 (이미 작성됨) */
export async function getFoodStoresByCategory(req, res) {
    const { category } = req.query;
    try {
        const result = await pool.query(
            `
      SELECT fs.id,
             fs.business_name,
             fs.business_category,
             COALESCE(MIN(si.url), '') AS image
      FROM food_stores fs
      LEFT JOIN store_images si ON fs.id = si.store_id
      WHERE fs.business_category = $1
      GROUP BY fs.id
      LIMIT 20
      `,
            [category]
        );

        const stores = result.rows.map((r) => ({
            id: r.id,
            name: r.business_name,
            category: r.business_category,
            image: r.image || "/uploads/no-image.png",
        }));

        res.json({ ok: true, stores });
    } catch (err) {
        console.error("getFoodStoresByCategory error", err);
        res.status(500).json({ ok: false, error: "서브카테고리 조회 실패" });
    }
}

/** 뷰티/통합 서브카테고리 조회 (이미 작성됨) */
export async function getCombinedStoresByCategory(req, res) {
    const { category } = req.query; // /api/subcategory/beauty?category=미용
    if (!category) {
        return res
            .status(400)
            .json({ ok: false, error: "category가 필요합니다." });
    }

    try {
        const result = await client.query(
            `
  SELECT fs.id,
         fs.business_name,
         fs.business_category,
         COALESCE(MIN(si.url), '') AS image_url
  FROM food_stores fs
  LEFT JOIN store_images si ON fs.id = si.store_id
  WHERE fs.business_category ILIKE '%' || $1 || '%'
  GROUP BY fs.id
  LIMIT 20
  `,
            [category]
        );

        const stores = result.rows.map((r) => ({
            id: r.id,
            name: r.business_name,
            category: r.category,
            image: r.image || "/uploads/no-image.png",
        }));

        res.json({ ok: true, stores });
    } catch (err) {
        console.error("getCombinedStoresByCategory error:", err);
        res.status(500).json({ ok: false, error: "서브카테고리 조회 실패" });
    }
}


/** ✅ Best Seller: 조회수가 많은 가게 (조회수 컬럼 없으면 created_at 기준으로 대체) */
export async function getBestStores(req, res) {
    try {
        const result = await pool.query(
            `
      SELECT fs.id,
             fs.business_name,
             fs.business_category,
             COALESCE(MIN(si.url), '') AS image
      FROM food_stores fs
      LEFT JOIN store_images si ON fs.id = si.store_id
      GROUP BY fs.id
      ORDER BY fs.created_at ASC  -- ⚠️ 조회수 컬럼 없으므로 오래된 순으로 대체
      LIMIT 8
      `
        );

        const stores = result.rows.map((r) => ({
            id: r.id,
            name: r.business_name,
            category: r.business_category,
            image: r.image || "/uploads/no-image.png",
        }));

        res.json({ ok: true, stores });
    } catch (err) {
        console.error("getBestStores error:", err);
        res.status(500).json({ ok: false, error: "베스트셀러 조회 실패" });
    }
}

/** ✅ New registration: 최근 일주일 등록된 가게 */
export async function getNewStores(req, res) {
    try {
        const result = await pool.query(
            `
      SELECT fs.id,
             fs.business_name,
             fs.business_category,
             COALESCE(MIN(si.url), '') AS image
      FROM food_stores fs
      LEFT JOIN store_images si ON fs.id = si.store_id
      WHERE fs.created_at >= NOW() - INTERVAL '7 days'
      GROUP BY fs.id
      ORDER BY fs.created_at DESC
      LIMIT 8
      `
        );

        const stores = result.rows.map((r) => ({
            id: r.id,
            name: r.business_name,
            category: r.business_category,
            image: r.image || "/uploads/no-image.png",
        }));

        res.json({ ok: true, stores });
    } catch (err) {
        console.error("getNewStores error:", err);
        res.status(500).json({ ok: false, error: "신규 등록 가게 조회 실패" });
    }
}
