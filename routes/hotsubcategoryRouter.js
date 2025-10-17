// routes/hotsubcategoryRouter.js
import express from "express";
import pool from "../db.js"; // PostgreSQL 연결 (Neon DB)
import * as ctrl from "../controllers/hotsubcategoryController.js"; // ✅ 추가: 컨트롤러 연결
const router = express.Router();

// 핫 서브카테고리(테마) 전용 API
router.get("/sub/theme", ctrl.getHotSubTheme);

/* =====================================================
   📦 핫 서브카테고리 데이터 조회 API
   GET /api/hotsubcategory
   ===================================================== */
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        id,
        title,
        category,
        thumbnail_url,
        description
      FROM hotsubcategory
      ORDER BY id ASC
    `);

    res.json({ ok: true, data: result.rows });
  } catch (err) {
    console.error("❌ [hotsubcategory 조회 오류]:", err.message);
    res.status(500).json({ ok: false, error: "서버 내부 오류" });
  }
});

/* =====================================================
   📦 (선택) 특정 ID로 상세 조회
   GET /api/hotsubcategory/:id
   ===================================================== */
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `
      SELECT 
        id,
        title,
        category,
        thumbnail_url,
        description
      FROM hotsubcategory
      WHERE id = $1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: "데이터 없음" });
    }

    res.json({ ok: true, data: result.rows[0] });
  } catch (err) {
    console.error("❌ [hotsubcategory 단일 조회 오류]:", err.message);
    res.status(500).json({ ok: false, error: "서버 내부 오류" });
  }
});

export default router;
