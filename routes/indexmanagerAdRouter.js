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
  makeMulterStorage,
  fileFilter,
} from "../controllers/indexmanagerAdController.js";

const router = express.Router();

// ✅ 최후 폴백 저장 경로 (서버.js에서 /uploads -> /data/uploads 서빙 중)
const FALLBACK_DIR = "/data/uploads";
if (!fs.existsSync(FALLBACK_DIR)) fs.mkdirSync(FALLBACK_DIR, { recursive: true });

const fallbackStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, FALLBACK_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    cb(null, `${randomUUID()}${ext}`);
  },
});

// ✅ makeMulterStorage()가 뭘 주든 “엔진”으로 통일
const candidate = makeMulterStorage?.();
let storage = fallbackStorage;

// 1) 이미 엔진이면 그대로 사용
if (candidate && typeof candidate._handleFile === "function") {
  storage = candidate;
}
// 2) { destination, filename } 옵션이면 diskStorage로 엔진 생성
else if (
  candidate &&
  typeof candidate === "object" &&
  (candidate.destination || candidate.filename)
) {
  storage = multer.diskStorage(candidate);
}

const upload = multer({
  storage, // ✅ 여기 반드시 '엔진'이 들어가야 함
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// ✅ 파일 필드 이름 여러개 허용
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
