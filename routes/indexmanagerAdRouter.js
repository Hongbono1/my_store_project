import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

import {
  uploadIndexAd,
  saveIndexStoreAd,
  connectStoreToSlot,
  getIndexSlot,
  getIndexTextSlot,
  saveIndexTextSlot,
  getBestPickSlots,
  searchStoreByBiz,
  deleteSlot,
} from "../controllers/indexmanagerAdController.js";

const router = express.Router();

/**
 * ✅ 업로드 경로는 프로젝트 정책에 맞게 조정
 * - 당신은 /data/uploads 영속 경로를 자주 쓰고,
 * - 프론트/응답은 /uploads/* 형태를 기대함
 */
const uploadDir = "/data/uploads";
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    const safeExt = ext && ext.length < 10 ? ext : "";
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${safeExt}`);
  },
});

const upload = multer({ storage });

/**
 * ✅ 슬롯 업로드/저장
 * - 프론트에서 file field name이 image 라는 전제
 *   (다르면 single("...") 부분만 프론트와 통일)
 */
router.post("/upload", upload.single("image"), uploadIndexAd);

/**
 * ✅ 가게 연결
 */
router.post("/store", saveIndexStoreAd);
router.post("/store/connect", connectStoreToSlot);

/**
 * ✅ 슬롯 조회/삭제
 */
router.get("/slot", getIndexSlot);
router.delete("/slot", deleteSlot);

/**
 * ✅ Best Pick 집계
 */
router.get("/best-pick", getBestPickSlots);

/**
 * ✅ 사업자번호 검색
 */
router.get("/store/search", searchStoreByBiz);

/**
 * ✅ 텍스트 슬롯
 */
router.get("/text/get", getIndexTextSlot);
router.post("/text/save", saveIndexTextSlot);

export default router;
