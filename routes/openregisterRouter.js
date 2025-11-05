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
      console.log("📝 [openregister] 요청 데이터:", req.body);
      console.log("📁 [openregister] 업로드된 파일:", req.file);

      const {
         store_name,
         open_date,
         category,
         phone,
         address,          // 주소 (기본 + 상세 합쳐진 것)
         description       // HTML 에디터 내용 (descHtml 필드에서 전송됨)
      } = req.body;

      // 필수값 검사
      if (!store_name || !open_date || !phone) {
         console.log("❌ 필수값 누락:", { store_name, open_date, phone });
         return res.json({ success: false, error: "필수 항목 누락 (상호명, 오픈일, 전화번호)" });
      }

      // 이미지 경로 설정
      const imagePath = req.file ? `/uploads/${req.file.filename}` : null;
      
      console.log("💾 DB 저장 준비:", {
         store_name,
         open_date, 
         category,
         phone,
         description: description ? description.substring(0, 100) + "..." : null,
         address,
         imagePath
      });

      // PostgreSQL 저장
      const result = await pool.query(
         `INSERT INTO open_stores 
          (store_name, open_date, category, phone, description, address, image_path, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
          RETURNING id`,
         [
            store_name,
            open_date,
            category || null,
            phone,
            description || null,
            address || null,
            imagePath
         ]
      );

      console.log("✅ [openregister] 등록 성공 - ID:", result.rows[0].id);
      res.json({ success: true, id: result.rows[0].id });

   } catch (err) {
      console.error("❌ [openregister] 오류:", err);
      res.status(500).json({ 
         success: false, 
         error: "DB 저장 실패",
         message: err.message 
      });
   }
});

// ✅ 오픈예정 전체 조회 API
router.get("/", async (req, res) => {
   try {
      const result = await pool.query(
         `SELECT id, store_name, open_date, category, phone, description, address, image_path, created_at
          FROM open_stores 
          ORDER BY created_at DESC`
      );
      
      res.json({ success: true, data: result.rows });
   } catch (err) {
      console.error("❌ [openregister] 조회 오류:", err);
      res.status(500).json({ success: false, error: err.message });
   }
});

// ✅ 단일 조회 API
router.get("/:id", async (req, res) => {
   try {
      const { id } = req.params;
      const result = await pool.query(
         `SELECT id, store_name, open_date, category, phone, description, address, image_path, created_at
          FROM open_stores 
          WHERE id = $1`,
         [id]
      );

      if (result.rowCount === 0) {
         return res.status(404).json({ success: false, error: "데이터를 찾을 수 없습니다" });
      }

      res.json({ success: true, data: result.rows[0] });
   } catch (err) {
      console.error("❌ [openregister] 단일 조회 오류:", err);
      res.status(500).json({ success: false, error: err.message });
   }
});

export default router;
