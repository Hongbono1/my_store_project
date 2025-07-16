import express from "express";
import { pool } from "../db/pool.js";
import multer from "multer";
import path from "path";

const router = express.Router();

// multer: 원본 확장자까지 살려 저장
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public/uploads/");
  },
  filename: function (req, file, cb) {
    // 예: 1689981234-originalname.jpg 처럼 저장 (중복방지)
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext);
    cb(null, Date.now() + "-" + basename + ext);
  }
});
const upload = multer({ storage });

router.post("/", upload.single("img"), async (req, res) => {
  const {
    name, openDate, category, addr, phone, desc, owner, email
  } = req.body;

  const thumbnail = req.file ? "/uploads/" + req.file.filename : "";

  const sql = `
    INSERT INTO open_store
      (store_name, address, phone, open_date, description, category, owner, email, thumbnail)
    VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id
  `;

  try {
    const { rows } = await pool.query(sql, [
      name, addr, phone, openDate, desc, category, owner, email, thumbnail
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
