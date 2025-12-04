// routes/indexmanagerAdRouter.js
import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";

import {
  uploadIndexAd,
  saveIndexStoreAd,
  getIndexSlot,
  getIndexText,
  saveIndexText,
} from "../controllers/indexmanagerAdController.js";

const router = express.Router();

// ==============================
// 📂 multer 설정 (public/uploads)
// ==============================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = path.join(__dirname, "..", "public", "uploads");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    const base = path.basename(file.originalname || "banner", ext);
    const unique = Date.now() + "_" + Math.random().toString(36).slice(2, 8);
    cb(null, `${base}_${unique}${ext}`);
  },
});

const upload = multer({ storage });

// ==============================
// 🔗 라우터 매핑
// base: /manager
// ==============================

// 배너/프로모 슬롯 조회
// GET /manager/ad/slot?page=index&position=index_main_top
router.get("/ad/slot", getIndexSlot);

// 배너/프로모 이미지 업로드 + 저장
// POST /manager/ad/upload (multipart/form-data)
router.post("/ad/upload", upload.single("image"), uploadIndexAd);

// 등록된 가게로 연결
// POST /manager/ad/store (JSON)
router.post("/ad/store", saveIndexStoreAd);

// 텍스트 슬롯 조회 / 저장
// GET  /manager/ad/text/get
router.get("/ad/text/get", getIndexText);
// POST /manager/ad/text/save
router.post("/ad/text/save", saveIndexText);

export default router;
