// routes/managerAdRouter.js
import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import pool from "../db.js";
import { uploadManagerAd, saveBannerSlot, saveTextSlot, getSlot, getTextSlot } from "../controllers/indexmanagerAdController.js";  // ✅ 올바른 파일명

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

// ==============================
// 📌 🔥 통합 슬롯 조회 API (배너용)
// ==============================
router.get("/slot", async (req, res) => {
    try {
        const { page, position } = req.query;

        if (!page || !position) {
            return res.json({ ok: false, message: "page와 position 필요" });
        }

        const sql = `
            SELECT id, page, position, image_url, link_url, created_at
            FROM manager_ads
            WHERE page = $1 AND position = $2
            ORDER BY created_at DESC
            LIMIT 1
        `;

        const result = await pool.query(sql, [page, position]);
        return res.json({ ok: true, slot: result.rows[0] || null });

    } catch (err) {
        console.error("SLOT GET ERROR:", err);
        return res.json({ ok: false, slot: null });
    }
});

// ==============================
// 📌 텍스트 저장 (UPSERT)
// ==============================
router.post("/text/save", async (req, res) => {
    try {
        const { page, position, content } = req.body;

        if (!page || !position) {
            return res.json({ ok: false, message: "page와 position이 필요합니다." });
        }

        const sql = `
            INSERT INTO manager_texts (page, position, content)
            VALUES ($1, $2, $3)
            ON CONFLICT (page, position)
            DO UPDATE SET content = EXCLUDED.content, updated_at = NOW()
            RETURNING id
        `;

        const result = await pool.query(sql, [page, position, content || ""]);
        return res.json({ ok: true, id: result.rows[0].id });

    } catch (err) {
        console.error("MANAGER TEXT SAVE ERROR:", err);
        return res.json({ ok: false, message: "서버 오류" });
    }
});

// ==============================
// 📌 텍스트 조회 (특정 슬롯)
// ==============================
router.get("/text/get", async (req, res) => {
    try {
        const { page, position } = req.query;

        const sql = `
            SELECT * FROM manager_texts
            WHERE page = $1 AND position = $2
            LIMIT 1
        `;

        const result = await pool.query(sql, [page, position]);
        return res.json({ ok: true, text: result.rows[0] || null });

    } catch (err) {
        console.error("MANAGER TEXT GET ERROR:", err);
        return res.json({ ok: false });
    }
});

export default router;

