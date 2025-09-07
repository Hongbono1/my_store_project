import pool from "../db.js";

/** 홍보 블로그 등록 */
export async function registerHotBlog(req, res) {
    try {
        console.log("[hotblog] body:", req.body);
        console.log("[hotblog] files:", (req.files || []).map(f => ({
            field: f.fieldname, name: f.originalname, saved: f.filename
        })));

        const { title, store_name, category, qa_mode, phone, url } = req.body || {};
        let { qa } = req.body || {};

        // 필수값 미리 검증 (DB NOT NULL 예방)
        if (!title || !store_name || !category || !qa_mode) {
            return res.status(400).json({
                success: false,
                error: "missing_fields",
                require: {
                    title: !!title,
                    store_name: !!store_name,
                    category: !!category,
                    qa_mode: !!qa_mode,
                },
            });
        }

        // 업로드된 파일 중 coverImage만 사용
        let coverImage = null;
        if (Array.isArray(req.files)) {
            const cf = req.files.find(f => f.fieldname === "coverImage");
            if (cf) coverImage = `/uploads/${cf.filename}`;
        }

        // qa 직렬화
        if (qa && typeof qa !== "string") {
            try { qa = JSON.stringify(qa); } catch { qa = "[]"; }
        }
        if (!qa) qa = "[]";

        const userId = 1; // 임시 고정

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
            [userId, title, store_name, category, qa_mode, qa, phone || null, url || null, coverImage]
        );

        return res.json({ success: true, id: result.rows[0].id, message: "홍보 블로그 저장 완료" });
    } catch (err) {
        console.error("registerHotBlog error:", err);
        return res.status(500).json({ success: false, error: "DB insert/update failed", detail: err?.message });
    }
}

/** 홍보 블로그 단일 조회 */
export async function getHotBlog(req, res) {
    try {
        const { id } = req.params;
        const result = await pool.query(`SELECT * FROM hotblogs WHERE id = $1`, [id]);
        if (result.rows.length === 0) return res.status(404).json({ success: false, error: "not_found" });

        const blog = result.rows[0];
        try { blog.qa = JSON.parse(blog.qa || "[]"); } catch { blog.qa = []; }

        res.json({ success: true, blog });
    } catch (err) {
        console.error("[getHotBlog]", err);
        res.status(500).json({ success: false, error: err.message });
    }
}
