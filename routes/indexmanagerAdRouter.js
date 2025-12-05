// routes/indexmanagerAdRouter.js
import express from "express";
import multer from "multer";
import path from "path";
import {
  uploadIndexAd,
  getIndexSlot,
  getIndexTextSlot,
} from "../controllers/indexmanagerAdController.js";

const router = express.Router();

// ✅ 서버와 동일한 업로드 루트 경로 (A 방식)
const UPLOAD_ROOT = "/data/uploads";

// Multer 스토리지 설정
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_ROOT); // ← "/data/uploads" 로 통일
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + "_" + Math.random().toString(36).slice(2, 8);
    const ext = path.extname(file.originalname);
    cb(null, unique + ext);
  },
});

// Multer 인스턴스 생성
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    // 이미지 파일만 허용
    const allowedMimes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("이미지 파일만 업로드 가능합니다."));
    }
  },
});

/* ============================
 *  인덱스 레이아웃 광고 관리 API
 * ============================ */

// 배너/이미지 슬롯 업로드 (이미지 파일 포함)
router.post("/upload", upload.single("image"), uploadIndexAd);

// 배너/이미지 슬롯 조회
router.get("/slot", getIndexSlot);

// 텍스트 슬롯 조회 (slot_type='text'만)
router.get("/text/get", getIndexTextSlot);

export default router;
