// routes/indexmanagerAdRouter.js
import { Router } from "express";
import multer from "multer";
import path from "path";
import {
  uploadIndexAd,
  getIndexSlot,
  getIndexTextSlot,
} from "../controllers/indexmanagerAdController.js";

const router = Router();

// Multer 설정
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(process.cwd(), "public", "uploads"));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || "";
    const base = path.basename(file.originalname, ext).replace(/\s+/g, "_");
    const stamp = Date.now();
    cb(null, `${stamp}_${base}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

// 배너/이미지 슬롯 업로드 & 조회
router.post("/upload", upload.single("image"), uploadIndexAd);
router.get("/slot", getIndexSlot);

// 텍스트 슬롯 조회
router.get("/text/get", getIndexTextSlot);

export default router;
