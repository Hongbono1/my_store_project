import express from "express";
import { pool } from "../db/pool.js";
import multer from "multer";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.post("/", upload.single("img"), async (req, res) => {
  // 프론트 input의 name과 반드시 일치!
  const {
    store_name,      // <input name="store_name">
    open_date,       // <input name="open_date">
    address,         // <input name="address">
    phone,           // <input name="phone">
    description,     // <textarea name="description">
    owner,           // <input name="owner">
    email            // <input name="email">
  } = req.body;
  const thumbnail = req.file ? "/uploads/" + req.file.filename : "";

  const sql = `
    INSERT INTO open_store
      (store_name, address, phone, open_date, description, owner, email, thumbnail)
    VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id
  `;

  try {
    const { rows } = await pool.query(sql, [
      store_name,
      address,
      phone,
      open_date,
      description,
      owner,
      email,
      thumbnail
    ]);
    res.json({ success: true, id: rows[0].id });
  } catch (err) {
    console.error("등록 오류:", err);
    res.status(500).json({ success: false, error: "저장 오류" });
  }
});

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
