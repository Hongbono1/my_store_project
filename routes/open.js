import express from "express";
import { pool } from "../db/pool.js";
import multer from "multer";
import path from "path";

const router = express.Router();

// 파일명: [타임스탬프]-[정제된원본명][.확장자]로 저장
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public/uploads/");
  },
  filename: function (req, file, cb) {
    // 특수문자/공백 제거, 한글-영어-숫자-_-만 허용 (자주 쓰는 패턴)
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9가-힣_.-]/g, "_");
    cb(null, Date.now() + "-" + base + ext);
  }
});
const upload = multer({ storage });

// 등록
router.post("/", upload.single("img"), async (req, res) => {
  const {
    store_name, open_date, category, addr, phone, desc, owner, email
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
      store_name, addr, phone, open_date, desc, category, owner, email, thumbnail
    ]);
    res.json({ success: true, id: rows[0].id });
  } catch (err) {
    console.error("등록 오류:", err);
    res.status(500).json({ success: false, error: "저장 오류" });
  }
});

// 목록 조회
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
