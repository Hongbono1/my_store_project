// controllers/hotblogregisterController.js
import pool from "../db.js";

/**
 * 홍보 블로그 등록
 * - qa는 항상 JSON.stringify() 해서 저장
 */
export async function registerHotBlog(req, res) {
    try {
        const { title, qa_mode } = req.body;
        let { qa } = req.body;
        const coverImage = req.body.coverImage || null;

        // qa가 문자열이 아니면 강제로 JSON 문자열로 변환
        if (qa && typeof qa !== "string") {
            try {
                qa = JSON.stringify(qa);
            } catch (e) {
                console.error("[registerHotBlog] qa stringify 실패:", e);
                qa = "[]"; // 안전 fallback
            }
        }

        const result = await pool.query(
            `INSERT INTO hotblogs (title, qa_mode, qa, cover_image, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id`,
            [title, qa_mode, qa || "[]", coverImage]
        );

        res.json({ success: true, id: result.rows[0].id });
    } catch (err) {
        console.error("[registerHotBlog]", err);
        res.status(500).json({ success: false, error: err.message });
    }
}

/**
 * 홍보 블로그 단일 조회
 */
export async function getHotBlog(req, res) {
    try {
        const { id } = req.params;
        const result = await pool.query(
            `SELECT * FROM hotblogs WHERE id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: "not_found" });
        }

        const blog = result.rows[0];

        // qa를 JSON.parse 해서 객체/배열로 반환 (프론트에서 그대로 사용 가능)
        try {
            blog.qa = JSON.parse(blog.qa || "[]");
        } catch {
            blog.qa = [];
        }

        res.json({ success: true, blog });
    } catch (err) {
        console.error("[getHotBlog]", err);
        res.status(500).json({ success: false, error: err.message });
    }
}
