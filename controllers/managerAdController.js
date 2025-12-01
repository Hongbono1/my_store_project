// controllers/managerAdController.js
import pool from "../db.js";

// ==============================
// 📌 광고 저장 컨트롤러
// ==============================
export const uploadManagerAd = async (req, res) => {
    try {
        const { page, position, link_url } = req.body;

        if (!req.file) {
            return res.json({ ok: false, message: "이미지가 없습니다." });
        }

        const image_url = "/uploads/manager_ads/" + req.file.filename;

        const sql = `
            INSERT INTO manager_ads (page, position, link_url, image_url)
            VALUES ($1, $2, $3, $4)
            RETURNING id
        `;

        const result = await pool.query(sql, [
            page,
            position,
            link_url,
            image_url
        ]);

        return res.json({ ok: true, id: result.rows[0].id });

    } catch (err) {
        console.error("MANAGER AD ERROR:", err);
        return res.json({ ok: false, message: "서버 오류" });
    }
};
