import express from "express";
import { upload } from "../middlewares/upload.js";
import pool from "../db.js";

const router = express.Router();

// ---------------------- 등록 ----------------------
router.post("/register", upload.fields([
    { name: "image_main", maxCount: 1 },
    { name: "image_banner", maxCount: 3 },
    { name: "image_best", maxCount: 4 }
]), async (req, res) => {

    try {
        const body = req.body;

        const main = req.files["image_main"]?.[0]?.filename || null;

        const banners = req.files["image_banner"]?.map(f => f.filename) || [];
        const bests = req.files["image_best"]?.map(f => f.filename) || [];

        const inserted = await pool.query(`
            INSERT INTO shopping_info
            (shop_name, short_desc, full_desc, category, website,
             sns_instagram, sns_youtube, sns_blog,
             image_main, image_banner1, image_banner2, image_banner3,
             image_best1, image_best2, image_best3, image_best4)
            VALUES ($1,$2,$3,$4,$5,
                    $6,$7,$8,
                    $9,$10,$11,$12,
                    $13,$14,$15,$16)
            RETURNING id;
        `, [
            body.shop_name,
            body.short_desc,
            body.full_desc || null,
            body.category,
            body.website,
            body.sns_instagram || null,
            body.sns_youtube || null,
            body.sns_blog || null,
            main ? `/uploads/${main}` : null,
            banners[0] ? `/uploads/${banners[0]}` : null,
            banners[1] ? `/uploads/${banners[1]}` : null,
            banners[2] ? `/uploads/${banners[2]}` : null,
            bests[0] ? `/uploads/${bests[0]}` : null,
            bests[1] ? `/uploads/${bests[1]}` : null,
            bests[2] ? `/uploads/${bests[2]}` : null,
            bests[3] ? `/uploads/${bests[3]}` : null
        ]);

        res.json({ success: true, id: inserted.rows[0].id });

    } catch (e) {
        console.error("SHOP REGISTER ERROR:", e);
        res.json({ success: false, message: "등록 실패" });
    }
});

// ---------------------- 상세 ----------------------
router.get("/:id", async (req, res) => {
    try {
        const id = req.params.id;
        const shop = await pool.query("SELECT * FROM shopping_info WHERE id=$1", [id]);
        res.json(shop.rows[0] || {});
    } catch (error) {
        console.error("SHOP DETAIL ERROR:", error);
        res.status(500).json({ error: "상세 조회 실패" });
    }
});

// ---------------------- 리스트 ----------------------
router.get("/", async (req, res) => {
    try {
        const list = await pool.query("SELECT * FROM shopping_info ORDER BY created_at DESC");
        res.json(list.rows);
    } catch (error) {
        console.error("SHOP LIST ERROR:", error);
        res.status(500).json({ error: "리스트 조회 실패" });
    }
});

export default router;
