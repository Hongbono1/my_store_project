// routes/managerAdRouter.js
import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import pool from "../db.js";  // ✅ pool import 추가
import { uploadManagerAd } from "../controllers/managerAdController.js";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 업로드 폴더
const storage = multer.diskStorage({
    destination(req, file, cb) {
        cb(null, path.join(__dirname, "../public/uploads/manager_ads"));
    },
    filename(req, file, cb) {
        const ext = path.extname(file.originalname);
        const name = Date.now() + "_" + Math.random().toString(36).substring(2);
        cb(null, `${name}${ext}`);
    }
});

const upload = multer({ storage });

// ==============================
// 📌 광고 업로드 (manager)
// ==============================
router.post(
    "/upload",
    upload.single("image"),
    uploadManagerAd
);

// ==============================
// 📌 랜덤 광고 가져오기
// ==============================
router.get("/random", async (req, res) => {
    try {
        const { page, position } = req.query;

        const sql = `
            SELECT * FROM manager_ads
            WHERE page = $1 AND position = $2
            ORDER BY RANDOM()
            LIMIT 1
        `;

        const result = await pool.query(sql, [page, position]);
        return res.json({ ok: true, ad: result.rows[0] || null });

    } catch (err) {
        console.error("MANAGER AD RANDOM ERROR:", err);
        return res.json({ ok: false });
    }
});

export default router;  // ✅ export는 맨 마지막에!

