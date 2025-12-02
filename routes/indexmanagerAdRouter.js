// routes/managerAdRouter.js
import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";

import {
  uploadManagerAd,
  saveTextSlot,
  getSlot,
  getTextSlot,
} from "../controllers/managerAdController.js";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename); // ✅ 수정: path.dirname(__filename)

// 🔹 업로드 폴더: public/uploads/manager_ad
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "..", "public", "uploads", "manager_ad"));
  },
  filename: (req, file, cb) => {
    const ts = Date.now();
    const rnd = Math.random().toString(36).slice(2, 8);
    const ext = path.extname(file.originalname) || "";
    cb(null, `${ts}_${rnd}${ext}`);
  },
});

const upload = multer({ storage });

/**
 * 🔵 인덱스/메인 관리자용 배너/이미지 저장
 * - POST /manager/ad/upload
 * - form-data: image(선택), page, position, link_url(선택)
 */
router.post(
  "/manager/ad/upload",
  upload.single("image"),
  uploadManagerAd
);

/**
 * 🟢 인덱스/메인 관리자용 텍스트 저장
 * - POST /manager/ad/text/save
 * - JSON: { page, position, content }
 */
router.post(
  "/manager/ad/text/save",
  express.json(),
  saveTextSlot
);

/**
 * (옵션) 슬롯 조회
 * GET /manager/ad/slot?page=index_main&position=main_top_banner
 */
router.get("/manager/ad/slot", getSlot);

/**
 * (옵션) 텍스트 슬롯 조회
 * GET /manager/ad/text?page=index_main&position=index_main_text
 */
router.get("/manager/ad/text", getTextSlot);

export default router;

