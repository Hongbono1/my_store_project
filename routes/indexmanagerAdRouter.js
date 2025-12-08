// routes/indexmanagerAdRouter.js
import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";

import {
  uploadIndexAd,
  saveIndexStoreAd,
  getIndexSlot,
  getIndexTextSlot,
  saveIndexTextSlot,
  getBestPickSlots,
  searchStoreByBiz,
  connectStoreToSlot,
  deleteSlot,
} from "../controllers/indexmanagerAdController.js";

const router = express.Router();

/**
 * ✅ 관리자 광고 업로드용 multer
 * - /data/uploads 우선, 없으면 public/uploads
 * - 파일명 충돌 방지
 */
function resolveUploadDir() {
  const preferred = "/data/uploads";
  const fallback = path.join(process.cwd(), "public", "uploads");

  if (fs.existsSync(preferred)) return preferred;
  if (!fs.existsSync(fallback)) fs.mkdirSync(fallback, { recursive: true });
  return fallback;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = resolveUploadDir();
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    const safe = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, safe);
  },
});

const upload = multer({ storage });

/* =========================
 * ✅ 슬롯 업로드
 * ========================= */
router.post("/upload", upload.single("image"), uploadIndexAd);

/* =========================
 * ✅ 슬롯 조회
 * ========================= */
router.get("/slot", getIndexSlot);

/* =========================
 * ✅ Best Pick 목록
 * ========================= */
router.get("/best-pick", getBestPickSlots);

/* =========================
 * ✅ 텍스트 슬롯
 * ========================= */
router.get("/text/get", getIndexTextSlot);
router.post("/text/save", saveIndexTextSlot);

/* =========================
 * ✅ 사업자번호 기반 가게 검색
 * ========================= */
router.get("/store/search", searchStoreByBiz);

/* =========================
 * ✅ 기존 방식 가게 연결
 * ========================= */
router.post("/store", saveIndexStoreAd);

/* =========================
 * ✅ 신규 엔드포인트 가게 연결
 * ========================= */
router.post("/store/connect", connectStoreToSlot);

/* =========================
 * ✅ 슬롯 삭제
 * ========================= */
router.delete("/slot", deleteSlot);

export default router;
