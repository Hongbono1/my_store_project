import express from "express";
import pool from "../db.js"; // 반드시 DB 연결 임포트

const router = express.Router();   // ★이 부분 반드시 있어야 함

// /recommend (ex. 메인에서 사용)
router.get("/", async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM recommendation_info ORDER BY id DESC LIMIT 10");
  res.json(rows);
});
router.get("/api", async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM recommendation_info ORDER BY id DESC LIMIT 10");
  res.json(rows);
});


export default router;
