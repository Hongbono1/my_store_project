import pool from "../db.js";

/** 음식점 업종별 가게 조회 */
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

        const stores = result.rows.map(r => ({
            id: r.id,
            name: r.business_name,
            category: r.business_category,
            image: r.image || "/uploads/no-image.png"
        }));

        res.json({ ok: true, stores });
    } catch (err) {
        console.error("getFoodStoresByCategory error", err);
        res.status(500).json({ ok: false, error: "서브카테고리 조회 실패" });
    }
}

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
                   cs.business_subcategory AS category,
                   COALESCE(MIN(ci.url), '') AS image
            FROM combined_store_info cs
            LEFT JOIN combined_store_images ci ON cs.id = ci.store_id
            WHERE cs.business_subcategory ILIKE $1
            GROUP BY cs.id
            LIMIT 20
            `,
            [category]
        );

        const stores = result.rows.map(r => ({
            id: r.id,
            name: r.business_name,
            category: r.category,
            image: r.image || "/uploads/no-image.png"
        }));

        res.json({ ok: true, stores });
    } catch (err) {
        console.error("getCombinedStoresByCategory error:", err);
        res.status(500).json({ ok: false, error: "서브카테고리 조회 실패" });
    }
}
