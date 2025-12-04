// routes/indexmanagerAdRouter.js
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

import {
  getSlot,
  uploadSlot,
  linkStoreSlot,
  getTextSlot,
  saveTextSlot,
} from "../controllers/indexmanagerAdController.js";

const router = express.Router();

// __dirname 대체 (ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 업로드 폴더: 프로젝트 루트 기준 public/uploads
const uploadDir = path.join(__dirname, "..", "public", "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// multer 설정
const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, uploadDir);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext);
    const unique = Date.now() + "_" + Math.round(Math.random() * 1e6);
    cb(null, `${basename}_${unique}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

// ===============================
// base: /manager/ad
// ===============================

// 인덱스 레이아웃 배너/이미지 슬롯 조회
router.get("/slot", getSlot);

// 이미지 + 링크 업로드
router.post("/upload", upload.single("image"), uploadSlot);

// 등록된 가게 연결 (사업자번호 + 상호)
router.post("/store", linkStoreSlot);

// 텍스트 슬롯 조회/저장
router.get("/text/get", getTextSlot);
router.post("/text/save", saveTextSlot);

export default router;
