import express from "express";
import pool from "../db.js";

const router = express.Router();

/**
 * /api/suggest?mood=데이트
 */
router.get("/", async (req, res) => {
    try {
        let { mood } = req.query;

        // mood 값 확인 로그
        console.log("🧩 요청받은 mood:", mood);

        // 한글 인코딩 깨짐 방지
        if (!mood || mood === "전체") {
            const { rows } = await pool.query("SELECT * FROM store_menu ORDER BY id DESC LIMIT 8");
            return res.json({ ok: true, data: rows });
        }

        // 정확한 매칭 실패 방지 → LIKE로 변경
        const query = `
      SELECT * 
      FROM store_menu 
      WHERE theme ILIKE $1
      ORDER BY id DESC
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
