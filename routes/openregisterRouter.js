import express from "express";
import multer from "multer";
import path from "path";
import pool from "../db.js";

const router = express.Router();

// ✅ multer 설정
const storage = multer.diskStorage({
   destination: (req, file, cb) => cb(null, "public/uploads"),
   filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const fileName = `${Date.now()}${ext}`;
      cb(null, fileName);
   },
});
const upload = multer({ storage });

// ✅ 오픈예정 등록 API
router.post("/", upload.single("img"), async (req, res) => {
   try {
      const {
         store_name,
         open_date,
         category,
         phone,
         description,
         address,
         detail_address,
      } = req.body;

      const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

      // PostgreSQL 저장 (위도·경도 제외)
      const result = await pool.query(
         `INSERT INTO open_stores 
       (store_name, open_date, category, phone, description, address, detail_address, image_path)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id`,
         [
            store_name,
            open_date,
            category,
            phone,
            description,
            address,
            detail_address,
            imagePath,
         ]
      );

      res.json({ success: true, id: result.rows[0].id });
   } catch (err) {
      console.error("오픈예정 등록 오류:", err);
      res.status(500).json({ success: false, message: "DB 저장 실패" });
   }
});

export default router;
