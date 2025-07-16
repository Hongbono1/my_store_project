import express from "express";
import { pool } from "../db/pool.js";
import multer from "multer";

const router = express.Router();

// 이미지 업로드용 multer 설정
const upload = multer({ dest: "uploads/" });

// POST /open - 오픈예정 등록 (multer 적용!)
router.post("/", upload.single("img"), async (req, res) => {
  // multer가 req.body/req.file 자동 파싱
  const {
    name,           // <input name="name">
    openDate,       // <input name="openDate">
    category,       // <input name="category">
    phone,          // <input name="phone">
    desc,           // <textarea name="desc">
    addr            // <input name="addr">
    // 필요시 lat, lng 추가
  } = req.body;
  const thumbnail = req.file ? "/uploads/" + req.file.filename : "";

  const sql = `
    INSERT INTO open_store
      (store_name, address, phone, open_date, description, category, thumbnail)
    VALUES
      ($1, $2, $3, $4, $5, $6, $7)
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

