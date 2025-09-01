// controllers/subcategoryController.js
import pool from "../db.js";

/** 음식점 업종별 가게 조회 */
export async function getFoodStoresByCategory(req, res) {
    const { category } = req.query;
    if (!category) {
        return res.status(400).json({ ok: false, error: "category가 필요합니다." });
    }

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
        console.error("getFoodStoresByCategory error:", err);
        res.status(500).json({ ok: false, error: "서브카테고리 조회 실패" });
    }
}

/** 뷰티/통합 서브카테고리 조회 */
/** 뷰티/통합 서브카테고리 조회 */
export async function getCombinedStoresByCategory(req, res) {
    const { category } = req.query;
    if (!category) {
        return res.status(400).json({ ok: false, error: "category가 필요합니다." });
    }

    try {
        const result = await pool.query(
            `
      SELECT cs.id,
             cs.business_name,
             cs.business_category AS category,   -- ✅ 여기서 category는 business_category
             COALESCE(MIN(ci.url), '') AS image
      FROM combined_store_info cs
      LEFT JOIN combined_store_images ci ON cs.id = ci.store_id
      WHERE cs.business_category ILIKE $1      -- ✅ 검색도 business_category 로
      GROUP BY cs.id
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


/** Best Seller (조회수 기준 + 최신순 보조정렬) */
export async function getBestStores(req, res) {
    try {
        const result = await pool.query(
            `
      SELECT id,
             business_name,
             business_category,
             COALESCE((SELECT url FROM store_images si WHERE si.store_id = fs.id LIMIT 1), '') AS image
      FROM food_stores fs
      ORDER BY view_count DESC NULLS LAST, created_at DESC
      LIMIT 20
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
        res.status(500).json({ ok: false, error: "Best stores 조회 실패" });
    }
}

/** New registration (최근 7일 내 등록된 가게) */
export async function getNewStores(req, res) {
    try {
        const result = await pool.query(
            `
      SELECT id,
             business_name,
             business_category,
             COALESCE((SELECT url FROM store_images si WHERE si.store_id = fs.id LIMIT 1), '') AS image
      FROM food_stores fs
      WHERE created_at >= NOW() - INTERVAL '7 days'
      ORDER BY created_at DESC
      LIMIT 20
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
        res.status(500).json({ ok: false, error: "신규 가게 조회 실패" });
    }
}
