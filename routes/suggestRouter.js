import express from "express";
import pool from "../db.js";

const router = express.Router();

/* ✅ 실제 데이터 불러오기 */
router.get("/", async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT 
        id,
        business_name AS name,
        category,
        description,
        COALESCE(image1, '/uploads/default.jpg') AS img
      FROM combined_store_info
      ORDER BY id DESC
      LIMIT 50
    `);

        res.json({ ok: true, data: result.rows });
    } catch (err) {
        console.error("❌ [suggest 조회 오류]:", err);
        res.status(500).json({ ok: false, error: "server_error" });
    }
});

export default router;
