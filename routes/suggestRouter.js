import express from "express";
import pool from "../db.js";

const router = express.Router();

/**
 * /api/suggest?mood=데이트
 * store_menu + store_info JOIN → 상호명 표시
 */
router.get("/", async (req, res) => {
    try {
        let { mood } = req.query;
        console.log("🧩 요청받은 mood:", mood);

        // 전체 보기
        if (!mood || mood === "전체") {
            const { rows } = await pool.query(`
        SELECT sm.*, si.store_name AS store_name
        FROM store_menu sm
        LEFT JOIN store_info si ON sm.store_id = si.id
        ORDER BY sm.id DESC
        LIMIT 8
      `);
            return res.json({ ok: true, data: rows });
        }

        // mood(테마)로 필터
        const query = `
      SELECT sm.*, si.store_name AS store_name
      FROM store_menu sm
      LEFT JOIN store_info si ON sm.store_id = si.id
      WHERE sm.theme ILIKE $1
      ORDER BY sm.id DESC
      LIMIT 8
    `;
        const values = [`%${mood.trim()}%`];
        const { rows } = await pool.query(query, values);

        console.log("🎯 쿼리 결과:", rows);
        res.json({ ok: true, data: rows });
    } catch (err) {
        console.error("❌ /api/suggest 오류:", err);
        res.status(500).json({ ok: false, error: "server_error" });
    }
});

export default router;
