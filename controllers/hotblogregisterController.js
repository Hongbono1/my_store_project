// controllers/hotblogregisterController.js
import pool from "../db.js";

/**
 * 홍보 블로그 등록
 * - qa는 항상 JSON.stringify() 해서 저장
 */
export async function registerHotBlog(req, res) {
    try {
        console.log("[DEBUG body]", req.body);
        console.log("[DEBUG file]", req.file);

        const { title, store_name, category, qa_mode, phone, url } = req.body;
        let { qa } = req.body;
        const coverImage = req.file ? `/uploads/${req.file.filename}` : null;

        const userId = 1; // ⚠️ 로그인 시스템 없음 → 임시 고정

        // qa JSON 변환
        if (qa && typeof qa !== "string") {
            try {
                qa = JSON.stringify(qa);
            } catch {
                qa = "[]";
            }
        }

        const result = await pool.query(
            `
            INSERT INTO hotblogs (user_id, title, store_name, category, qa_mode, qa, phone, url, cover_image, created_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now())
            ON CONFLICT (user_id)
            DO UPDATE SET
              title       = EXCLUDED.title,
              store_name  = EXCLUDED.store_name,
              category    = EXCLUDED.category,
              qa_mode     = EXCLUDED.qa_mode,
              qa          = EXCLUDED.qa,
              phone       = EXCLUDED.phone,
              url         = EXCLUDED.url,
              cover_image = EXCLUDED.cover_image,
              created_at  = now()
            RETURNING id
            `,
            [userId, title, store_name, category, qa_mode, qa, phone, url, coverImage]
        );

        const blogId = result.rows[0].id;

        res.json({ success: true, id: blogId, message: "홍보 블로그 저장 완료" });
    } catch (err) {
        console.error("registerHotBlog error:", err);
        res.status(500).json({ success: false, error: "DB insert/update failed" });
    }
}

/**
 * 홍보 블로그 단일 조회
 */
export async function getHotBlog(req, res) {
    try {
        const { id } = req.params;
        const result = await pool.query(`SELECT * FROM hotblogs WHERE id = $1`, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: "not_found" });
        }

        const blog = result.rows[0];

        // qa를 JSON.parse 해서 배열로 반환
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
