import pool from "../db.js";
import path from "path";

const toWeb = (file) => (file ? "/uploads/" + path.basename(file.filename) : null);

export async function registerHotBlog(req, res) {
    const client = await pool.connect();
    try {
        const { mode, title, category, content } = req.body;

        const coverFile = req.files.find(f => f.fieldname === "coverImage");
        const coverImage = coverFile ? toWeb(coverFile) : null;

        // 질문/답변/이미지 데이터 JSON 묶기
        const qa = [];
        for (const [key, val] of Object.entries(req.body)) {
            if (/_q\d+/.test(key)) {
                qa.push({ field: key, value: val });
            }
        }
        req.files.forEach(f => {
            if (/_q\d+_image/.test(f.fieldname)) {
                qa.push({ field: f.fieldname, value: toWeb(f) });
            }
        });

        const result = await client.query(
            `INSERT INTO hot_blogs (mode, title, cover_image, category, content, qa)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id`,
            [mode, title, coverImage, category || null, content || null, JSON.stringify(qa)]
        );

        res.json({ success: true, id: result.rows[0].id });
    } catch (err) {
        console.error("[hotblog] insert error", err);
        res.status(500).json({ success: false, error: "DB insert failed" });
    } finally {
        client.release();
    }
}
