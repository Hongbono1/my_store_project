import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import pool from "../db.js"; // 네온 PostgreSQL Pool

const router = express.Router();

// ✅ 업로드 표준
const SUBDIR = "events";
const UPLOAD_DIR = `/data/uploads/${SUBDIR}`;

// ✅ 폴더 보장
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// ✅ multer 설정
const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname || "");
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, safeName);
  },
});

const upload = multer({ storage });

// ✅ 이벤트 등록
router.post(
  "/register",
  upload.fields([
    { name: "thumbnail", maxCount: 1 },
    { name: "detailImages", maxCount: 10 },
  ]),
  async (req, res) => {
    try {
      const {
        title,
        summary,
        type,
        start_date,
        end_date,
        benefit,
        content,
        store_id,
      } = req.body;

      // ✅ 썸네일 경로 표준
      const thumbnail = req.files?.thumbnail?.[0]
        ? `/uploads/${SUBDIR}/${req.files.thumbnail[0].filename}`
        : null;

      // ✅ 상세 이미지 경로 표준
      const detailImages = req.files?.detailImages
        ? req.files.detailImages.map((f) => `/uploads/${SUBDIR}/${f.filename}`)
        : [];

      const sql = `
        INSERT INTO events
        (title, summary, type, start_date, end_date, benefit, content, thumbnail, detail_images, store_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        RETURNING id
      `;

      const result = await pool.query(sql, [
        title,
        summary,
        type,
        start_date || null,
        end_date || null,
        benefit,
        content,
        thumbnail,
        detailImages,
        store_id || null,
      ]);

      return res.json({ ok: true, id: result.rows[0].id });
    } catch (e) {
      console.error("❌ [eventregister] error:", e);
      return res.json({ ok: false, error: e.message });
    }
  }
);

export default router;
