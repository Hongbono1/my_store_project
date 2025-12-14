// routes/indexmanagerAdRouter.js
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";

import {
  getSlot,
  listSlots,
  listSlotItems,
  upsertSlot,
  deleteSlot,
  searchStore,
  fileFilter, // 기존 필터 그대로 사용
} from "../controllers/indexmanagerAdController.js";

const router = express.Router();

// ✅ indexmanager 광고 업로드는 무조건 여기로 저장
const MANAGER_AD_DIR = "/data/uploads/manager_ad";
if (!fs.existsSync(MANAGER_AD_DIR)) fs.mkdirSync(MANAGER_AD_DIR, { recursive: true });

// ✅ multer “엔진”을 라우터에서 확정
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, MANAGER_AD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    cb(null, `${randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// ✅ 파일 필드 이름 여러개 허용 (기존 그대로)
const uploadFields = upload.fields([
  { name: "image", maxCount: 1 },
  { name: "slotImage", maxCount: 1 },
  { name: "file", maxCount: 1 },
]);

// 조회
router.get("/slot", getSlot);
router.get("/slots", listSlots);

// 후보 전체
router.get("/slot-items", listSlotItems);

// 저장/삭제
router.post("/slot", uploadFields, upsertSlot);
router.delete("/slot", deleteSlot);

// 가게 검색
router.get("/store/search", searchStore);

export default router;
