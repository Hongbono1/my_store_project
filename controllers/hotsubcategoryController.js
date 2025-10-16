// controllers/hotsubcategoryController.js
import pool from "../db.js";

/** 🔥 핫 서브카테고리 목록 */
export async function getHotSubcategories(req, res) {
    try {
        const { category, limit, sort } = req.query;
        const params = [];
        let sql = `
      SELECT id, title, store_name, category, subcategory, cover_image, rating, address, desc, created_at
      FROM hotsubcategories
    `;

        if (category && category !== "all") {
            sql += ` WHERE category = $1`;
            params.push(category);
        }

        switch (sort) {
            case "latest":
                sql += " ORDER BY created_at DESC";
                break;
            case "rating":
                sql += " ORDER BY rating DESC NULLS LAST";
                break;
            default:
                sql += " ORDER BY created_at DESC";
                break;
        }

        if (limit) sql += ` LIMIT ${Number(limit) || 20}`;

        const { rows } = await pool.query(sql, params);
        res.json({ success: true, data: rows });
    } catch (err) {
        console.error("[getHotSubcategories]", err);
        res.status(500).json({ success: false, error: "internal_error" });
    }
}

/** 🔍 단일 서브카테고리 조회 */
export async function getHotSubcategoryById(req, res) {
    try {
        const { id } = req.params;
        const { rows } = await pool.query(
            `SELECT * FROM hotsubcategories WHERE id = $1`,
            [id]
        );
        if (rows.length === 0) return res.status(404).json({ success: false, error: "not_found" });
        res.json({ success: true, data: rows[0] });
    } catch (err) {
        console.error("[getHotSubcategoryById]", err);
        res.status(500).json({ success: false, error: "internal_error" });
    }
}
