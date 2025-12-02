// routes/managerAdRouter.js
import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

import {
  uploadManagerAd,
  saveTextSlot,
  getSlot,
  getTextSlot,
} from "../controllers/managerAdController.js";

const router = express.Router();

// ES6 모듈에서 __dirname 설정
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 업로드 폴더 확인 및 생성
const uploadDir = path.join(__dirname, "..", "public", "uploads", "manager_ad");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log("📁 manager_ad 폴더 생성:", uploadDir);
}

// 🔹 업로드 폴더: public/uploads/manager_ad
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
 * 🔵 인덱스/메인 관리자용 배너/이미지 저장
 * - POST /manager/ad/upload
 * - form-data: image(선택), page, position, link_url(선택)
 */
router.post(
  "/manager/ad/upload",
  upload.single("image"),
  uploadManagerAd
);

/**
 * 🟢 인덱스/메인 관리자용 텍스트 저장
 * - POST /manager/ad/text/save
 * - JSON: { page, position, content }
 */
router.post(
  "/manager/ad/text/save",
  express.json(),
  saveTextSlot
);

/**
 * (옵션) 슬롯 조회
 * GET /manager/ad/slot?page=index_main&position=main_top_banner
 */
router.get("/manager/ad/slot", getSlot);

/**
 * (옵션) 텍스트 슬롯 조회
 * GET /manager/ad/text?page=index_main&position=index_main_text
 */
router.get("/manager/ad/text", getTextSlot);

export default router;

