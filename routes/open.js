import express from "express";
import { pool } from "../db/pool.js";
const router = express.Router();

// POST /open - 오픈예정 등록
router.post("/", async (req, res) => {
  const {
    store_name,
    address,
    phone,
    open_date,
    description,
    thumbnail
  } = req.body;

  const sql = `
    INSERT INTO open_store
      (store_name, address, phone, open_date, description, thumbnail)
    VALUES
      ($1, $2, $3, $4, $5, $6)
    RETURNING id
  `;

  try {
    const { rows } = await pool.query(sql, [
      store_name,
      address,
      phone,
      open_date,
      description,
      thumbnail
    ]);
    res.json({ success: true, id: rows[0].id });
  } catch (err) {
    console.error("등록 오류:", err);
    res.status(500).json({ success: false, error: "저장 오류" });
  }
});

// GET /open - 오픈예정 리스트
router.get("/", async (req, res) => {
  try {
    const sql = `SELECT * FROM open_store ORDER BY created_at DESC`;
    const { rows } = await pool.query(sql);
    res.json(rows);
  } catch (err) {
    console.error("조회 오류:", err);
    res.status(500).json({ error: "조회 오류" });
  }
});

export default router;
