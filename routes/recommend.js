import express from "express";
import pool from "../db.js"; // 네온DB 커넥션

const router = express.Router();

router.get("/api", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM recommendation_info ORDER BY id DESC LIMIT 10");
    res.json(rows);
  } catch (e) {
    res.status(500).json({ success: false, error: "DB 조회 오류" });
  }
});

export default router;

