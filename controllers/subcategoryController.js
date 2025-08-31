// controllers/subcategoryController.js
import pool from "../db.js";

/** 음식점 업종별 가게 조회 */
export async function getFoodStoresByCategory(req, res) {
    const { category } = req.query; // ex) /api/subcategory/food?category=한식
    try {
        const client = await pool.connect();

        // 가게 기본 정보
        const result = await client.query(
            `SELECT fs.id, fs.business_name, fs.business_category, si.image_path
       FROM food_stores fs
       LEFT JOIN store_images si ON fs.id = si.store_id
       WHERE fs.business_category = $1
       GROUP BY fs.id, si.image_path
       LIMIT 20`,
            [category]
        );

        client.release();

        // JSON 변환 (가게 카드용)
        const stores = result.rows.map(r => ({
            id: r.id,
            name: r.business_name,
            category: r.business_category,
            image: r.image_path || "/uploads/no-image.png"
        }));

        res.json({ ok: true, stores });
    } catch (err) {
        console.error("getFoodStoresByCategory error", err);
        res.status(500).json({ ok: false, error: "서브카테고리 조회 실패" });
    }
}

/** 뷰티/통합 서브카테고리 조회 */
export async function getCombinedStoresByCategory(req, res) {
    const { category } = req.params; // ex) /api/subcategory/combined/Soap
    try {
        const client = await pool.connect();

        const result = await client.query(
            `SELECT cs.id, cs.business_name, cs.business_category, ci.image_path
       FROM combined_store_info cs
       LEFT JOIN combined_store_images ci ON cs.id = ci.store_id
       WHERE cs.business_category = $1
       GROUP BY cs.id, ci.image_path
       LIMIT 20`,
            [category]
        );

        client.release();

        const stores = result.rows.map(r => ({
            id: r.id,
            name: r.business_name,
            category: r.business_category,
            image: r.image_path || "/uploads/no-image.png"
        }));

        res.json({ ok: true, stores });
    } catch (err) {
        console.error("getCombinedStoresByCategory error", err);
        res.status(500).json({ ok: false, error: "서브카테고리 조회 실패" });
    }
}
