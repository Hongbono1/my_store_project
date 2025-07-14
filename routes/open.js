import express from "express";
import { pool } from "../db/pool.js"; // DB 커넥션 경로에 맞게 수정
const router = express.Router();

/**
 * [1] 오픈예정 등록 (POST /open)
 */
router.post("/", async (req, res) => {
  const {
    owner,
    email,
    store_name,
    address,
    phone,
    open_date,
    description,
    thumbnail
  } = req.body;

  const sql = `
    INSERT INTO open_store
      (owner, email, store_name, address, phone, open_date, description, thumbnail)
    VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id
  `;

  try {
    const { rows } = await pool.query(sql, [
      owner,
      email,
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

/**
 * [2] 오픈예정 리스트(조회, GET /open)
 * (선택) 필요 없으면 생략 가능
 */
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
