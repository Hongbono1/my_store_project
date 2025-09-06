import pool from "../db.js";

// 블로그 등록
export async function registerHotBlog(req, res) {
    try {
        const { title, qa_mode } = req.body;
        const qa = req.body.qa ? JSON.stringify(req.body.qa) : null;

        // 파일 업로드가 multer로 처리된 경우
        const coverImage = req.file ? `/uploads/${req.file.filename}` : null;

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

        // qa 필드는 JSON.parse 해서 클라이언트에 전달
        const blog = result.rows[0];
        if (blog.qa) {
            try {
                blog.qa = JSON.parse(blog.qa);
            } catch {
                // 파싱 실패 시 그대로 둠
            }
        }

        res.json({ success: true, blog });
    } catch (err) {
        console.error("[getHotBlog]", err);
        res.status(500).json({ success: false, error: err.message });
    }
}
