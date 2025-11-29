import express from "express";
import pool from "../db.js";

const router = express.Router();

/**
 * GET /api/suggest?mood=데이트
 *  - 전체: store_menu 전체에서 최신순 8개
 *  - 특정 mood: sm.theme 에 mood 포함된 것만 8개
 *  - 응답 형식: { ok: true, data: [ { id, store_id, name, image_url, theme, store_name } ] }
 */
router.get("/", async (req, res) => {
  let { mood } = req.query;
  mood = (mood || "").toString().trim();

  console.log("🧩 [/api/suggest] 요청받은 mood:", mood || "(전체)");

  try {
    // 공통 SELECT 구문 (프론트에 맞게 alias 통일)
    const baseSelect = `
      SELECT
        sm.id,
        sm.store_id,
        sm.menu_name  AS name,
        sm.menu_image AS image_url,
        sm.theme,
        si.business_name AS store_name
      FROM store_menu sm
      LEFT JOIN store_info si ON sm.store_id = si.id
    `;

    let sql;
    let params = [];

    // 1) 전체 보기
    if (!mood || mood === "전체") {
      sql = `
        ${baseSelect}
        ORDER BY sm.id DESC
        LIMIT 8
      `;
    } else {
      // 2) mood(테마)로 필터
      sql = `
        ${baseSelect}
        WHERE sm.theme ILIKE $1
        ORDER BY sm.id DESC
        LIMIT 8
      `;
      params = [`%${mood}%`];
    }

    const { rows } = await pool.query(sql, params);
    console.log("🎯 [/api/suggest] 조회 결과 개수:", rows.length);

    return res.json({ ok: true, data: rows });
  } catch (err) {
    console.error("❌ [/api/suggest] 서버 오류:", err);
    return res.status(500).json({
      ok: false,
      error: "server_error",
      detail: err?.message || String(err),
    });
  }
});

export default router;
