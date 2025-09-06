import pool from "../db.js";

// 블로그 등록
export async function registerHotBlog(req, res) {
    try {
        const { title, qa_mode, qa } = req.body;
        const coverImage = req.body.coverImage || null;

        const result = await pool.query(
            `INSERT INTO hotblogs (title, qa_mode, qa, cover_image, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id`,
            [title, qa_mode, qa, coverImage]
        );

        res.json({ success: true, id: result.rows[0].id });
    } catch (err) {
        console.error("[registerHotBlog]", err);
        res.status(500).json({ success: false, error: err.message });
    }
}

// 블로그 조회
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

        res.json({ success: true, blog: result.rows[0] });
    } catch (err) {
        console.error("[getHotBlog]", err);
        res.status(500).json({ success: false, error: err.message });
    }
}
