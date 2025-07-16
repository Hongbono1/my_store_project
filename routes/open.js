import express from "express";
import { pool } from "../db/pool.js";
import multer from "multer";
import path from "path";

const router = express.Router();

/* ---------- multer: 확장자 포함 파일명 저장 ---------- */
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, "public/uploads/"),
  filename:   (_, file, cb) => {
    const ext  = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext)
                 .replace(/[^a-zA-Z0-9가-힣_.-]/g, "_");
    cb(null, Date.now() + "-" + base + ext);
  }
});
const upload = multer({ storage });

/* ---------- POST /open ---------- */
router.post("/", upload.single("img"), async (req, res) => {
  /* HTML input 의 name 값과 **완전히 동일** 해야 함! */
  const {
    store_name,       // <input name="store_name">
    open_date,        // <input name="open_date">
    category,         // <input name="category">
    address,             // <input name="addr">   ← 주소
    phone,            // <input name="phone">
    desc,             // <textarea name="desc">
    owner,
    email
  } = req.body;

  /* 필수값 체크 (비어 있으면 400 에러) */
  if (!store_name || !addr || !open_date) {
    return res.status(400).json({ success:false, error:"필수항목 누락" });
  }

  const thumbnail = req.file ? "/uploads/" + req.file.filename : "";

  const sql = `
    INSERT INTO open_store
      (store_name, address, phone, open_date,
       description, category, owner, email, thumbnail)
    VALUES
      ($1,         $2,      $3,    $4,
       $5,         $6,      $7,    $8,    $9)
    RETURNING id
  `;

  try {
    const { rows } = await pool.query(sql, [
      store_name,
      address,
      phone,
      open_date,
      desc,
      category,
      owner,
      email,
      thumbnail
    ]);
    res.json({ success:true, id:rows[0].id });
  } catch (err) {
    console.error("등록 오류:", err);
    res.status(500).json({ success:false, error:"저장 오류" });
  }
});

/* ---------- GET /open ---------- */
router.get("/", async (_req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM open_store ORDER BY created_at DESC"
    );
    res.json(rows);
  } catch (err) {
    console.error("조회 오류:", err);
    res.status(500).json({ error:"조회 오류" });
  }
});

export default router;
