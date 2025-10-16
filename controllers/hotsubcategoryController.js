// controllers/hotsubcategoryController.js
import pool from "../db.js";

/* ==========================================================
   🔥 HOT SUBCATEGORY CONTROLLER
   ========================================================== */

/**
 * 전체 또는 특정 카테고리의 서브카테고리 리스트 반환
 * 예: GET /api/hotsubcategory?category=food
 */
export async function getHotSubcategories(req, res) {
    try {
        const { category, limit, sort } = req.query;

        const params = [];
        let sql = `
      SELECT id, title, store_name, category, subcategory, cover_image, rating, address, desc, created_at
      FROM hotsubcategories
    `;

        // ✅ category 필터 적용
        if (category && category !== "all") {
            sql += ` WHERE category = $1`;
            params.push(category);
        }

        // ✅ 정렬 조건
        switch (sort) {
            case "latest":
                sql += " ORDER BY created_at DESC";
                break;
            case "rating":
                sql += " ORDER BY rating DESC NULLS LAST";
                break;
            default:
                sql += " ORDER BY trending_score DESC NULLS LAST, created_at DESC";
                break;
        }

        // ✅ limit
        if (limit) sql += ` LIMIT ${Number(limit) || 20}`;

        const { rows } = await pool.query(sql, params);
        return res.json({ success: true, data: rows });
    } catch (err) {
        console.error("[getHotSubcategories]", err);
        res.status(500).json({ success: false, error: "internal_error" });
    }
}

/**
 * 단일 서브카테고리 상세조회
 * 예: GET /api/hotsubcategory/:id
 */
export async function getHotSubcategoryById(req, res) {
    try {
        const { id } = req.params;
        if (!id) return res.status(400).json({ success: false, error: "missing_id" });

        const { rows } = await pool.query(`
      SELECT id, title, store_name, category, subcategory, desc, cover_image, rating, address, created_at
      FROM hotsubcategories
      WHERE id = $1
    `, [id]);

        if (rows.length === 0) return res.status(404).json({ success: false, error: "not_found" });

        res.json({ success: true, data: rows[0] });
    } catch (err) {
        console.error("[getHotSubcategoryById]", err);
        res.status(500).json({ success: false, error: "internal_error" });
    }
}
