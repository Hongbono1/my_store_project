import express from "express";
import pool from "../db.js";

const router = express.Router();

/**
 * GET /api/suggest?mood=데이트
 * - 전체: 최신 메뉴 8개
 * - mood 선택: theme 기준으로 필터
 * - 응답 형식을 hot.html 스크립트에 맞게 alias (name, image_url, store_name)
 */
router.get("/", async (req, res) => {
  try {
    let { mood } = req.query;
    const rawMood = (mood || "").toString().trim();
    console.log("🧩 요청받은 mood:", rawMood || "(전체)");

    // === 1) 전체 보기 ===
    if (!rawMood || rawMood === "전체") {
      const sql = `
        SELECT
          sm.*,
          si.store_name AS store_name,      -- 가게 이름
          sm.menu_name  AS name,            -- 프론트에서 item.name 으로 사용
          sm.menu_image AS image_url        -- 프론트에서 item.image_url 로 사용
        FROM store_menu sm
        LEFT JOIN store_info si ON sm.store_id = si.id
        ORDER BY sm.id DESC
        LIMIT 8
      `;
      const { rows } = await pool.query(sql);
      console.log("✅ 전체 결과 rows:", rows.length);
      return res.json({ ok: true, data: rows });
    }

    // === 2) mood(테마)로 필터 ===
    const sql = `
      SELECT
        sm.*,
        si.store_name AS store_name,       -- 여기서도 통일
        sm.menu_name  AS name,
        sm.menu_image AS image_url
      FROM store_menu sm
      LEFT JOIN store_info si ON sm.store_id = si.id
      WHERE sm.theme ILIKE $1              -- theme 컬럼에 기분/상황 저장되어 있다고 가정
      ORDER BY sm.id DESC
      LIMIT 8
    `;
    const values = [`%${rawMood}%`];
    const { rows } = await pool.query(sql, values);

    console.log("🎯 mood 쿼리 결과:", rows.length);
    return res.json({ ok: true, data: rows });
  } catch (err) {
    console.error("❌ /api/suggest 오류:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

export default router;
