// routes/indexmanagerAdRouter.js
import express from "express";
import multer from "multer";
import path from "path";
import {
  uploadIndexAd,
  saveIndexStoreAd,
  getIndexSlot,
  getIndexTextSlot,
  saveIndexTextSlot,
  getBestPickSlots,
} from "../controllers/indexmanagerAdController.js";

const router = express.Router();

const UPLOAD_ROOT = "/data/uploads";

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_ROOT),
  filename: (req, file, cb) => {
    const unique = Date.now() + "_" + Math.random().toString(36).slice(2, 8);
    const ext = path.extname(file.originalname || "");
    cb(null, unique + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("이미지 파일만 업로드 가능합니다."));
  },
});

// 배너/이미지 슬롯 업로드
router.post("/upload", upload.single("image"), uploadIndexAd);

// ✅ 등록된 가게 연결 모드
router.post("/store", saveIndexStoreAd);

// 배너/이미지 슬롯 조회
router.get("/slot", getIndexSlot);

// 텍스트 슬롯 조회
router.get("/text/get", getIndexTextSlot);

// 텍스트 슬롯 저장
router.post("/text/save", saveIndexTextSlot);

// ✅ Best Pick 관리자 슬롯 미리보기용
router.get("/best-pick", getBestPickSlots);

export default router;
