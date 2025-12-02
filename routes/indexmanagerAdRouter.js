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
  assignStoreSlot, // ✅ 새로 추가 (controller에도 필요)
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
 * - POST /index/ad/upload
 * - form-data: image(선택), page, position, link_url(선택)
 */
router.post("/index/ad/upload", upload.single("image"), uploadManagerAd);

/**
 * 🟢 인덱스/메인 관리자용 텍스트 저장
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

/**
 * 🍽 등록된 가게를 슬롯에 연결 (사업자번호 + 상호)
 * - POST /index/ad/assign-store
 * - JSON: { page, position, business_no, business_name }
 */
router.post("/index/ad/assign-store", express.json(), assignStoreSlot);

// (선택) 기존 /manager/ad/... 경로도 유지하고 싶다면 아래처럼 alias로 남겨둘 수도 있음.
// router.post("/manager/ad/upload", upload.single("image"), uploadManagerAd);
// router.post("/manager/ad/text/save", express.json(), saveTextSlot);
// router.get("/manager/ad/slot", getSlot);
// router.get("/manager/ad/text", getTextSlot);

export default router;
