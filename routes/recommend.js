import express from "express";
import pool from "../db.js";
const router = express.Router();

// 공통 핸들러 – pageSize 파라미터 지원
async function fetchRecommendation(req, res) {
  const pageSize = Number(req.query.pageSize) || 8;          // 기본 8개
  const { rows } = await pool.query(
    "SELECT * FROM recommendation_info ORDER BY id DESC LIMIT $1",
    [pageSize]
  );
  res.json(rows);
}

router.get("/", fetchRecommendation);        // /recommend?pageSize=8
router.get("/api", fetchRecommendation);     // /recommend/api?pageSize=8  ←★ 새 alias

export default router;
