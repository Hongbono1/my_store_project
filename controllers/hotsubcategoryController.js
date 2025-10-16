// controllers/hotsubcategoryController.js
import pool from "../db.js";

/* ==========================================================
   🔥 HOT SUBCATEGORY CONTROLLER
   → 실제로는 hotblogs 테이블 데이터를 기반으로 작동
   ========================================================== */

/** ✅ 전체 또는 카테고리별 핫 서브카테고리 목록 (hotblogs 기반) */
export async function getHotSubcategories(req, res) {
    try {
        const { category, limit, sort } = req.query;
        const params = [];
        let sql = `
      SELECT id, title, store_name, category, cover_image, phone, url, address, qa_mode, created_at
      FROM hotblogs
    `;

        // 🔹 category 필터
        if (category && category !== "all") {
            sql += ` WHERE category = $1`;
            params.push(category);
        }

        // 🔹 정렬 조건
        switch (sort) {
            case "latest":
                sql += " ORDER BY created_at DESC";
                break;
            case "rating":
                sql += " ORDER BY qa_mode DESC NULLS LAST, created_at DESC";
                break;
            default:
                sql += " ORDER BY created_at DESC";
                break;
        }

        // 🔹 limit
        if (limit) sql += ` LIMIT ${Number(limit) || 50}`;

        const { rows } = await pool.query(sql, params);

        // 결과 반환
        res.json(rows);
    } catch (err) {
        console.error("[getHotSubcategories]", err);
        res.status(500).json({ ok: false, error: "internal_error" });
    }
}

/** ✅ 단일 서브카테고리 (hotblog) 조회 */
export async function getHotSubcategoryById(req, res) {
    try {
        const rawId = req.params.id;
        const id = Number.parseInt(rawId, 10);

        if (!Number.isSafeInteger(id)) {
            console.warn("[getHotSubcategoryById] invalid id:", rawId);
            return res.status(400).json({ success: false, error: "invalid_id", id: rawId });
        }

        const { rows } = await pool.query(
            `SELECT * FROM hotblogs WHERE id = $1`,
            [id]
        );

        if (rows.length === 0)
            return res.status(404).json({ success: false, error: "not_found" });

        res.json({ success: true, data: rows[0] });
    } catch (err) {
        console.error("[getHotSubcategoryById]", err);
        res.status(500).json({ success: false, error: "internal_error" });
    }
}

