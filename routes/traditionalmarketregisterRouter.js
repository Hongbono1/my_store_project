import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { createTraditionalMarket } from "../controllers/traditionalmarketregisterController.js";

const router = express.Router();

// ✅ 전통시장 업로드 저장 경로 고정
const UPLOAD_DIR = "/data/uploads/traditionalmarket";

// ✅ 폴더 없으면 생성
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// ✅ 파일명 생성
function makeFilename(file) {
  const ext = path.extname(file.originalname || "").toLowerCase();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
}

// ✅ multer 설정
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => cb(null, makeFilename(file)),
});

const marketUpload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

// 등록
router.post(
  "/",
  marketUpload.fields([
    { name: "main_img", maxCount: 1 },
    { name: "parking_img", maxCount: 1 },
    { name: "transport_img", maxCount: 1 },
    { name: "customq1_image", maxCount: 1 },
    { name: "customq2_image", maxCount: 1 },
    { name: "customq3_image", maxCount: 1 },
    { name: "customq4_image", maxCount: 1 },
    { name: "customq5_image", maxCount: 1 },
    { name: "customq6_image", maxCount: 1 },
    { name: "customq7_image", maxCount: 1 },
    { name: "customq8_image", maxCount: 1 },
    { name: "q1_image", maxCount: 1 },
    { name: "q2_image", maxCount: 1 },
    { name: "q3_image", maxCount: 1 },
    { name: "q4_image", maxCount: 1 },
    { name: "q5_image", maxCount: 1 },
    { name: "q6_image", maxCount: 1 },
    { name: "q7_image", maxCount: 1 },
    { name: "q8_image", maxCount: 1 },
    { name: "images", maxCount: 30 }, // 서브 이미지 여러개
  ]),
  createTraditionalMarket
);

export default router;
