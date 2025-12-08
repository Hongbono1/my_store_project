// routes/indexmanagerAdRouter.js
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

import {
  uploadIndexAd,
  saveIndexStoreAd,
  getIndexSlot,
  getBestPickSlots,
  searchStoreByBiz,
  deleteSlot,
} from "../controllers/indexmanagerAdController.js";

const router = express.Router();

/* =========================
 * ✅ 업로드 설정
 * - 기존 프로젝트 규칙에 맞춰 /data/uploads 우선 사용
 * ========================= */
const UPLOAD_DIR = process.env.UPLOAD_DIR || "/data/uploads";

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    const safeExt = ext && ext.length <= 10 ? ext : "";
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${safeExt}`);
  },
});

const upload = multer({ storage });

/* =========================
 * ✅ 라우팅
 * ========================= */

// 1) 배너/이미지 업로드 슬롯 저장
router.post("/upload", upload.single("image"), uploadIndexAd);

// 2) 가게 연결 저장 (best_pick_x 포함)
router.post("/store", saveIndexStoreAd);

// 3) 단일 슬롯 조회
router.get("/slot", getIndexSlot);

// 4) Best Pick 목록
router.get("/best-pick", getBestPickSlots);

// 5) 사업자번호로 가게 검색
router.get("/store/search", searchStoreByBiz);

// 6) 슬롯 삭제
router.delete("/slot", deleteSlot);

export default router;
