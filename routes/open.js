import express from "express";
import { pool } from "../db/pool.js";
import multer from "multer";
import path from "path";

const router = express.Router();

// 1️⃣ 저장시 원본명 포함하여 파일명 생성
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/uploads/");
  },
  filename: (req, file, cb) => {
    // 예: 1752711813244-원본명.jpg
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-_]/g, "_");
    cb(null, Date.now() + "-" + safeName);
  }
});
const upload = multer({ storage });

// 2️⃣ POST 등록 (원본 파일명 DB 저장)
router.post("/", upload.single("img"), async (req, res) => {
  // input name들과 일치!
  const {
    name,
    openDate,
    category,
    addr,
    phone,
    desc,
    owner,
    email
  } = req.body;
  const thumbnail = req.file ? "/uploads/" + req.file.filename : "";
  const original_filename = req.file ? req.file.originalname : "";

  const sql = `
    INSERT INTO open_store
      (store_name, address, phone, open_date, description, category, owner, email, thumbnail, original_filename)
    VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
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
      thumbnail,
      original_filename
    ]);
    res.json({ success: true, id: rows[0].id });
  } catch (err) {
    console.error("등록 오류:", err);
    res.status(500).json({ success: false, error: "저장 오류" });
  }
});

// 3️⃣ GET 목록 (기존과 동일)
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
