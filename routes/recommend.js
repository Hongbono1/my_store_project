import express from "express";
import pool from "../db.js";
const router = express.Router();

// 메인에서 최신 8개(여기선 2개지만, 최대 8개까지!)
router.get("/", async (req, res) => {
  const { rows } = await pool.query(
    "SELECT * FROM recommendation_info ORDER BY id DESC LIMIT 8"
  );
  res.json(rows);
});

export default router;
