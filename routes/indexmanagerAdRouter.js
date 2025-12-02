// routes/indexmanagerAdRouter.js
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

import {
  saveBannerSlot,
  saveTextSlot,
  getSlot,
  getTextSlot,
} from "../controllers/indexmanagerAdController.js";

const router = express.Router();

// ✅ ES 모듈용 __dirname 설정
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ 업로드 폴더: public/uploads/manager_ad
const uploadDir = path.join(__dirname, "..", "public", "uploads", "manager_ad");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log("📁 manager_ad 폴더 생성:", uploadDir);
}

// ✅ Multer 저장 설정
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ts = Date.now();
    const rnd = Math.random().toString(36).slice(2, 8);
    const ext = path.extname(file.originalname) || "";
    cb(null, `${ts}_${rnd}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

/**
 * 🔵 인덱스 레이아웃 배너/이미지 저장
 * - POST /index/ad/upload
 * - form-data: image(선택), page, position, link_url(선택)
 */
router.post("/index/ad/upload", upload.single("image"), saveBannerSlot);

/**
 * 🟢 인덱스 레이아웃 텍스트 슬롯 저장
 * - POST /index/ad/text/save
 * - JSON: { page, position, content }
 */
router.post("/index/ad/text/save", express.json(), saveTextSlot);

/**
 * (옵션) 슬롯 조회
 * GET /index/ad/slot?page=index&position=index_main_top
 */
router.get("/index/ad/slot", getSlot);

/**
 * (옵션) 텍스트 슬롯 조회
 * GET /index/ad/text?page=index&position=index_oneword
 */
router.get("/index/ad/text", getTextSlot);

export default router;
