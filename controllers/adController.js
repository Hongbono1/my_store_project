import pool from "../db/pool.js";
import path from "path";

// 광고 등록
export async function createAd(req, res) {
    try {
        const {
            title, advertiser, category, is_paid, description,
            exposure_limit, exposure_period, target_link
        } = req.body;
        const img_url = req.file ? "/uploads/" + req.file.filename : null;
        const result = await pool.query(
            `INSERT INTO main_ads
        (title, advertiser, category, is_paid, img_url, description, target_link, exposure_limit, exposure_left, exposure_period, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8,$9,'active')
       RETURNING *`,
            [title, advertiser, category, is_paid === 'true', img_url, description, target_link, exposure_limit, exposure_period]
        );
        res.json(result.rows[0]);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
}

// 광고 전체 조회
export async function getAllAds(req, res) {
    try {
        const result = await pool.query("SELECT * FROM main_ads ORDER BY ad_id DESC");
        res.json(result.rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
}

// 광고 삭제
export async function deleteAd(req, res) {
    try {
        const { ad_id } = req.params;
        await pool.query("DELETE FROM main_ads WHERE ad_id=$1", [ad_id]);
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
}

// 광고 노출수 차감(노출시)
export async function viewAd(req, res) {
    try {
        const { ad_id } = req.params;
        await pool.query(
            "UPDATE main_ads SET exposure_left = exposure_left - 1 WHERE ad_id=$1 AND exposure_left > 0",
            [ad_id]
        );
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
}
