// routes/indexmanagerAdRouter.js
import { Router } from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
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

// ✅ 업로드 루트: 반드시 /data/uploads 로 통일
const UPLOAD_ROOT = process.env.UPLOAD_ROOT || "/data/uploads";
fs.mkdirSync(UPLOAD_ROOT, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_ROOT),
  filename: (req, file, cb) => {
    const ts = Date.now();
    const base = (file.originalname || "image").replace(/[^\w.\-]+/g, "_");
    const ext = path.extname(base) || ".png";
    cb(null, `${ts}-${Math.random().toString(36).slice(2, 6)}${ext}`);
  },
});

const upload = multer({ storage });

const router = Router();

// 🟩 이미지+링크 업로드 저장
router.post("/upload", upload.single("image"), uploadIndexAd);

// 🟧 등록된 가게로 연결
router.post("/store", saveIndexStoreAd);
router.get("/store/search", searchStoreByBiz);
router.post("/store/connect", connectStoreToSlot);

// 🔎 슬롯/텍스트 로딩
router.get("/slot", getIndexSlot);
router.get("/text/get", getIndexTextSlot);
router.post("/text/save", saveIndexTextSlot);

// ⭐ Best Pick 목록
router.get("/best-pick", getBestPickSlots);

// 🗑️ 슬롯 삭제
router.delete("/slot", deleteSlot);

export default router;
