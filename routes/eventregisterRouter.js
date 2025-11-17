import express from "express";
import multer from "multer";
import path from "path";
import { pool } from "../db.js"; // 네온 PostgreSQL Pool

const router = express.Router();

// 업로드 폴더
const storage = multer.diskStorage({
    destination(req, file, cb) {
        cb(null, "public/uploads");
    },
    filename(req, file, cb) {
        cb(null, Date.now() + "_" + file.originalname);
    }
});
const upload = multer({ storage });

// 이벤트 등록
router.post(
    "/register",
    upload.fields([
        { name: "thumbnail", maxCount: 1 },
        { name: "detailImages", maxCount: 10 }
    ]),
    async (req, res) => {
        try {
            const {
                title,
                summary,
                type,
                start_date,
                end_date,
                benefit,
                content,
                store_id
            } = req.body;

            const thumbnail = req.files?.thumbnail ? `/uploads/${req.files.thumbnail[0].filename}` : null;

            const detailImages = req.files?.detailImages
                ? req.files.detailImages.map(f => `/uploads/${f.filename}`)
                : [];

            const sql = `
        INSERT INTO events
        (title, summary, type, start_date, end_date, benefit, content, thumbnail, detail_images, store_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        RETURNING id
      `;

            const result = await pool.query(sql, [
                title,
                summary,
                type,
                start_date || null,
                end_date || null,
                benefit,
                content,
                thumbnail,
                detailImages,
                store_id || null
            ]);

            res.json({ ok: true, id: result.rows[0].id });

        } catch (e) {
            res.json({ ok: false, error: e.message });
        }
    }
);

export default router;
