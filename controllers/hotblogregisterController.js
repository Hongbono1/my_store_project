// controllers/hotblogregisterController.js
import pool from "../db.js";

export async function registerHotBlog(req, res) {
    try {
        console.log("[DEBUG body]", req.body);
        console.log("[DEBUG files]", req.files);

        const { title, store_name, category, qa_mode, phone, url } = req.body;
        let { qa } = req.body;

        // 파일 중 coverImage 찾기
        let coverImage = null;
        if (req.files && req.files.length > 0) {
            const found = req.files.find(f => f.fieldname === "coverImage");
            if (found) coverImage = `/uploads/${found.filename}`;
        }

        const userId = 1;

        if (qa && typeof qa !== "string") {
            try {
                qa = JSON.stringify(qa);
            } catch {
                qa = "[]";
            }
        }

        if (!title || !qa_mode) {
            return res.status(400).json({ success: false, error: "title or qa_mode is missing" });
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
