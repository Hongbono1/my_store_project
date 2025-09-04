import pool from "../db.js";

/** ======================== 음식점 전용 ======================== */
// 음식점 업종별 가게 조회
export async function getFoodStoresByCategory(req, res) {
    const { category } = req.query;
    if (!category) {
        return res.status(400).json({ ok: false, error: "no_category" });
    }

    try {
        const result = await pool.query(
            `
            SELECT f.id,
                   f.business_name,
                   f.business_category AS category,
                   '음식점' AS business_type,
                   COALESCE((SELECT url FROM store_images WHERE store_id = f.id LIMIT 1), '') AS image
            FROM food_stores f
            WHERE f.business_category = $1
            ORDER BY f.created_at DESC
            `,
            [category]
        );

        const stores = result.rows.map((r) => ({
            id: r.id,
            name: r.business_name,
            category: r.category,
            image: r.image || "/uploads/no-image.png",
            business_type: r.business_type,
        }));

        res.json({ ok: true, stores });
    } catch (err) {
        console.error("getFoodStoresByCategory error:", err);
        res.status(500).json({ ok: false, error: "food 서브카테고리 조회 실패" });
    }
}

/** ======================== 통합/뷰티 ======================== */
// 통합/뷰티 서브카테고리 조회
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
                   cs.business_category AS category,
                   cs.business_type,
                   COALESCE((SELECT url FROM combined_store_images WHERE store_id = cs.id LIMIT 1), '') AS image
            FROM combined_store_info cs
            WHERE cs.business_category ILIKE $1
            ORDER BY cs.created_at DESC
            LIMIT 20
            `,
            [`%${category}%`]
        );

        const stores = result.rows.map((r) => ({
            id: r.id,
            name: r.business_name,
            category: r.category,
            business_type: r.business_type,
            image: r.image && r.image.trim() !== "" ? r.image : "/uploads/no-image.png",
        }));

        res.json({ ok: true, stores });
    } catch (err) {
        console.error("getCombinedStoresByCategory error:", err);
        res.status(500).json({ ok: false, error: "combined 서브카테고리 조회 실패" });
    }
}

/** ======================== Best / New ======================== */
// 음식점 Best Seller
export async function getBestFoodStores(req, res) {
    try {
        const result = await pool.query(
            `
            SELECT f.id,
                   f.business_name,
                   f.business_category AS category,
                   '음식점' AS business_type,
                   COALESCE((SELECT url FROM store_images WHERE store_id = f.id LIMIT 1), '') AS image
            FROM food_stores f
            ORDER BY f.view_count DESC NULLS LAST, f.created_at DESC
            LIMIT 20
            `
        );

        const stores = result.rows.map((r) => ({
            id: r.id,
            name: r.business_name,
            category: r.category,
            image: r.image || "/uploads/no-image.png",
            business_type: r.business_type,
        }));

        res.json({ ok: true, stores });
    } catch (err) {
        console.error("getBestFoodStores error:", err);
        res.status(500).json({ ok: false, error: "food Best stores 조회 실패" });
    }
}

// 음식점 신규 등록 (최근 7일)
export async function getNewFoodStores(req, res) {
    try {
        const result = await pool.query(
            `
            SELECT f.id,
                   f.business_name,
                   f.business_category AS category,
                   '음식점' AS business_type,
                   COALESCE((SELECT url FROM store_images WHERE store_id = f.id LIMIT 1), '') AS image
            FROM food_stores f
            WHERE f.created_at >= NOW() - INTERVAL '7 days'
            ORDER BY f.created_at DESC
            LIMIT 20
            `
        );

        const stores = result.rows.map((r) => ({
            id: r.id,
            name: r.business_name,
            category: r.category,
            image: r.image || "/uploads/no-image.png",
            business_type: r.business_type,
        }));

        res.json({ ok: true, stores });
    } catch (err) {
        console.error("getNewFoodStores error:", err);
        res.status(500).json({ ok: false, error: "food 신규 가게 조회 실패" });
    }
}

// 통합 Best Seller
export async function getBestCombinedStores(req, res) {
    try {
        const result = await pool.query(
            `
            SELECT cs.id,
                   cs.business_name,
                   cs.business_category AS category,
                   cs.business_type,
                   COALESCE((SELECT url FROM combined_store_images WHERE store_id = cs.id LIMIT 1), '') AS image
            FROM combined_store_info cs
            ORDER BY cs.view_count DESC NULLS LAST, cs.created_at DESC
            LIMIT 20
            `
        );

        const stores = result.rows.map((r) => ({
            id: r.id,
            name: r.business_name,
            category: r.category,
            image: r.image || "/uploads/no-image.png",
            business_type: r.business_type,
        }));

        res.json({ ok: true, stores });
    } catch (err) {
        console.error("getBestCombinedStores error:", err);
        res.status(500).json({ ok: false, error: "combined Best stores 조회 실패" });
    }
}

// 통합 신규 등록 (최근 7일)
export async function getNewCombinedStores(req, res) {
    try {
        const result = await pool.query(
            `
            SELECT cs.id,
                   cs.business_name,
                   cs.business_category AS category,
                   cs.business_type,
                   COALESCE((SELECT url FROM combined_store_images WHERE store_id = cs.id LIMIT 1), '') AS image
            FROM combined_store_info cs
            WHERE cs.created_at >= NOW() - INTERVAL '7 days'
            ORDER BY cs.created_at DESC
            LIMIT 20
            `
        );

        const stores = result.rows.map((r) => ({
            id: r.id,
            name: r.business_name,
            category: r.category,
            image: r.image || "/uploads/no-image.png",
            business_type: r.business_type,
        }));

        res.json({ ok: true, stores });
    } catch (err) {
        console.error("getNewCombinedStores error:", err);
        res.status(500).json({ ok: false, error: "combined 신규 가게 조회 실패" });
    }
}
