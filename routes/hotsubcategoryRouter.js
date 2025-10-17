import express from "express";
import pool from "../db.js";
const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, title, category, thumbnail_url, description
      FROM hotsubcategory
      ORDER BY id ASC
    `);
    res.json({ ok: true, data: result.rows });
  } catch (err) {
    console.error("❌ [hotsubcategory 조회 오류]:", err.message);
    res.status(500).json({ ok: false, error: "서버 내부 오류" });
  }
});

export default router;
