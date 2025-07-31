// routes/adminAds.js
import express from "express";
import multer from "multer";
import path from "path";
import pool from "../db/pool.js";

const router = express.Router();
const upload = multer({ dest: "public/uploads" });

// 광고 등록
router.post("/main-ads", upload.single("img"), async (req, res) => {
    try {
        const {
            title, advertiser, category, is_paid, description,
            exposure_limit, exposure_period, target_link
        } = req.body;

        const img_url = req.file ? "/uploads/" + req.file.filename : null;
        const result = await pool.query(
            `INSERT INTO main_ads
        (title, advertiser, category, is_paid, img_url, description, target_link, exposure_limit, exposure_left, exposure_period, status)
       VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$8,$9,'active') RETURNING *`,
            [
                title, advertiser, category, is_paid === 'true',
                img_url, description, target_link,
                exposure_limit, exposure_period
            ]
        );
        res.json(result.rows[0]);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 광고 리스트/수정/삭제/노출회수 조정 등 (필요시 추가 구현)
