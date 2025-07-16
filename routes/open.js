import express from "express";
import { pool } from "../db/pool.js";
import multer from "multer";

const router = express.Router();
const upload = multer({ dest: "public/uploads/" });  // 폴더 위치 변경!

router.post("/", upload.single("img"), async (req, res) => {
  // name은 프론트 input과 반드시 일치해야 함!
  const {
    name,             // <input name="name">
    openDate,         // <input name="openDate">
    category,         // <input name="category">
    addr,             // <input name="addr">
    phone,            // <input name="phone">
    desc,             // <textarea name="desc">
    owner,
    email
  } = req.body;
  const thumbnail = req.file ? "/uploads/" + req.file.filename : "";

  // ★ DDL에 category 컬럼 추가했다고 가정
  const sql = `
    INSERT INTO open_store
      (store_name, address, phone, open_date, description, category, owner, email, thumbnail)
    VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id
  `;

  try {
    const { rows } = await pool.query(sql, [
      name,
      addr,
      phone,
      openDate,
      desc,
      category,
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
