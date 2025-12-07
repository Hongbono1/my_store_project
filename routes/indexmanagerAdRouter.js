// routes/indexmanagerAdRouter.js
import express from "express";
import multer from "multer";
import path from "path";
import {
  uploadIndexAd,
  getIndexSlot,
  getIndexTextSlot,
  saveIndexTextSlot,
  getBestPickSlots,
  saveIndexStoreAd,
  // ✅ NEW: 가게 검색 API 컨트롤러
  searchIndexStoreAd,
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
    const allowedMimes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (allowedMimes.includes(file.mimetype)) cb(null, true);
    else cb(new Error("이미지 파일만 업로드 가능합니다."));
  },
});

// 기존 라우트들
router.post("/upload", upload.single("image"), uploadIndexAd);
router.get("/slot", getIndexSlot);

router.get("/text/get", getIndexTextSlot);
router.post("/text/save", saveIndexTextSlot);

// ✅ NEW: 등록된 가게 검색 (사업자번호 기반)
// app.use("/manager/ad", ...) 이므로 최종 엔드포인트는:
// GET /manager/ad/store/search?bizNo=xxxxxxxxxx
router.get("/store/search", searchIndexStoreAd);

router.post("/store", saveIndexStoreAd);
router.get("/best-pick", getBestPickSlots);

export default router;
