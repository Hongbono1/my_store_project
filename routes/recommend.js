// routes/recommend.js
import express from "express";
import pool from "../db.js";
const router = express.Router();

// 공통 핸들러 – pageSize 파라미터 지원
async function fetchRecommendation(req, res) {
  const pageSize = Number(req.query.pageSize) || 8;     // 메인용 기본 8개
  const { rows } = await pool.query(
    `SELECT id,
            title            AS store_name,   -- 카드에 맞춰 alias
            category,
            phone,
            thumbnail        AS img,
            address,
            open_date
       FROM store_info
       ORDER BY id DESC
       LIMIT $1`,
    [pageSize]
  );
  res.json(rows);
}

router.get("/",    fetchRecommendation);   //  /recommend?pageSize=8
router.get("/api", fetchRecommendation);   //  /recommend/api?pageSize=8

export default router;
