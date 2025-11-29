import express from "express";
import pool from "../db.js";

const router = express.Router();

/**
 * GET /api/suggest?mood=데이트
 *  - 전체: store_menu 전체에서 최신순 N개
 *  - mood 지정: sm.theme LIKE %mood% 인 N개
 *  - 응답: { ok: true, data: [ { id, store_id, name, image_url, theme, store_name } ] }
 */
router.get("/", async (req, res) => {
  try {
    let { mood } = req.query;
    console.log("🧩 요청받은 mood:", mood);

    if (!mood || mood === "전체") {
      const { rows } = await pool.query(`
        SELECT 
          sm.id,
          sm.store_id,
          sm.name       AS name,
          sm.image_url  AS image_url,
          sm.theme      AS theme,
          si.business_name AS store_name
        FROM store_menu sm
        LEFT JOIN store_info si ON sm.store_id = si.id
        ORDER BY sm.id DESC
        LIMIT 100
      `);
      return res.json({ ok: true, data: rows });
    }

    const query = `
      SELECT 
        sm.id,
        sm.store_id,
        sm.name       AS name,
        sm.image_url  AS image_url,
        sm.theme      AS theme,
        si.business_name AS store_name
      FROM store_menu sm
      LEFT JOIN store_info si ON sm.store_id = si.id
      WHERE sm.theme ILIKE $1
      ORDER BY sm.id DESC
      LIMIT 100
    `;
    const values = [`%${mood.trim()}%`];
    const { rows } = await pool.query(query, values);

    console.log("🎯 /api/suggest 쿼리 결과:", rows.length);
    res.json({ ok: true, data: rows });
  } catch (err) {
    console.error("❌ /api/suggest 오류:", err);
    res.status(500).json({ ok: false, error: "server_error", detail: err?.message || String(err) });
  }
});

/**
 * GET /api/suggest/top4
 *  - 클릭 수 기준 상위 4개 메뉴
 *  - sm.click_count 기준, 없으면 id 기준으로 폴백
 */
router.get("/top4", async (req, res) => {
  try {
    let rows = [];

    // 1차: click_count 기준 정렬 시도
    try {
      const { rows: r1 } = await pool.query(`
        SELECT 
          sm.id,
          sm.store_id,
          sm.name       AS name,
          sm.image_url  AS image_url,
          sm.theme      AS theme,
          si.business_name AS store_name,
          COALESCE(sm.click_count, 0) AS click_count
        FROM store_menu sm
        LEFT JOIN store_info si ON sm.store_id = si.id
        ORDER BY sm.click_count DESC NULLS LAST, sm.id DESC
        LIMIT 4
      `);
      rows = r1;
      console.log("🔥 /api/suggest/top4 click_count 기준 개수:", rows.length);
    } catch (err1) {
      console.warn("⚠️ click_count 정렬 실패, id 기준 폴백:", err1?.message || err1);
      const { rows: r2 } = await pool.query(`
        SELECT 
          sm.id,
          sm.store_id,
          sm.name       AS name,
          sm.image_url  AS image_url,
          sm.theme      AS theme,
          si.business_name AS store_name
        FROM store_menu sm
        LEFT JOIN store_info si ON sm.store_id = si.id
        ORDER BY sm.id DESC
        LIMIT 4
      `);
      rows = r2;
    }

    return res.json({ ok: true, data: rows });
  } catch (err) {
    console.error("❌ /api/suggest/top4 오류:", err);
    return res.status(500).json({
      ok: false,
      error: "server_error",
      detail: err?.message || String(err),
    });
  }
});

export default router;
