// controllers/hotblogregisterController.js
import pool from "../db.js";

/**
 * 홍보 블로그 등록
 * - qa는 항상 JSON.stringify() 해서 저장
 */
export async function registerHotBlog(req, res) {
    try {
        const { title, store_name, category, phone, url, address, qa_mode } = req.body;
        let { qa } = req.body;
        const coverImage = req.body.coverImage || null;

        // qa를 JSON 문자열로 변환
        if (qa && typeof qa !== "string") {
            try {
                qa = JSON.stringify(qa);
            } catch {
                qa = "[]";
            }
        }

        const result = await pool.query(
            `INSERT INTO hotblogs 
       (title, cover_image, store_name, category, phone, url, address, qa_mode, qa, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
       RETURNING id`,
            [title, coverImage, store_name, category, phone, url, address, qa_mode, qa]
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
