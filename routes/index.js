// routes/index.js
import express from "express";
import { pool } from "../db/pool.js";

const router = express.Router();

// "가장 핫한 우리동네" 리스트 API
router.get("/hot", async (req, res) => {
  const sql = `
    SELECT
      id,
      business_name AS title,
      business_name AS businessName, -- 상호명
      business_category AS category,
      phone_number AS phone,
      COALESCE(image1, '') AS img,
      (COALESCE(search_count, 0) + COALESCE(view_count, 0) + COALESCE(click_count, 0)) AS total_count
    FROM store_info
    ORDER BY total_count DESC
    LIMIT 8
  `;
  try {
    const { rows } = await pool.query(sql);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: "DB 조회 실패" });
  }
});

// (여기에 추가로 index 관련 라우팅이 있으면 붙여도 됨)

export default router;
