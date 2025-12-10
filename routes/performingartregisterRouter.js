import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { registerPerformingArt } from "../controllers/performingartregisterController.js";

const router = express.Router();

// ✅ A 방식 고정
const UPLOAD_ROOT = "/data/uploads";
const SUBDIR = "performingart";
const UPLOAD_DIR = path.join(UPLOAD_ROOT, SUBDIR);

// ✅ 폴더 없으면 생성
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  console.log("📁 [performingart] 폴더 생성:", UPLOAD_DIR);
} else {
  console.log("📁 [performingart] 폴더 존재:", UPLOAD_DIR);
}

// ✅ 파일명 생성 (충돌 최소화)
function makeFileName(originalname = "") {
  const ext = path.extname(originalname).toLowerCase();
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${unique}${ext}`;
}

// ✅ multer 설정 (라우터 내부 통합)
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => cb(null, makeFileName(file.originalname)),
});

const upload = multer({ storage });

// ✅ 공연/예술/축제 등록
router.post(
  "/",
  upload.fields([
    { name: "images", maxCount: 3 },
    { name: "pamphlet", maxCount: 6 },
  ]),
  registerPerformingArt
);

export default router;
