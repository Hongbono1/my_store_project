// routes/indexmanagerAdRouter.js
import express from "express";
import path from "path";
import fs from "fs";
import multer from "multer";

import {
  getAdSlot,
  uploadAdSlot,
  connectStoreToSlot,
  searchStoreByBizNo,
  getTextSlot,
  saveTextSlot,
} from "../controllers/indexmanagerAdController.js";

const router = express.Router();

/* =========================================================
   ✅ 광고 이미지 업로드 설정
   - 기본 저장 경로: public/uploads/ads
   - 필요하면 너의 업로드 정책에 맞게 경로만 바꿔도 OK
========================================================= */
const AD_UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "ads");

if (!fs.existsSync(AD_UPLOAD_DIR)) {
  fs.mkdirSync(AD_UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, AD_UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    const safeExt = ext ? ext.toLowerCase() : "";
    cb(null, `${Date.now()}_${Math.random().toString(36).slice(2, 10)}${safeExt}`);
  },
});

const adUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

/* =========================================================
   ✅ indexmanager.html에서 호출하는 엔드포인트
========================================================= */

// (1) 배너 슬롯 조회
// GET /manager/ad/slot?page=index&position=index_promo_1
router.get("/slot", getAdSlot);

// (2) 배너 슬롯 저장(이미지 + 링크 + 기간)
// multipart/form-data
// POST /manager/ad/upload
// field: image
router.post("/upload", adUpload.single("image"), uploadAdSlot);

// (3) 등록된 가게로 슬롯 연결
// POST /manager/ad/store
router.post("/store", connectStoreToSlot);

// (4) 사업자번호 기반 가게 검색(자동 후보)
// GET /manager/ad/store/search?bizNo=1234567890
router.get("/store/search", searchStoreByBizNo);

// (5) 텍스트 슬롯 조회
// GET /manager/ad/text/get?page=index&position=index_sub_news
router.get("/text/get", getTextSlot);

// (6) 텍스트 슬롯 저장
// POST /manager/ad/text/save
router.post("/text/save", saveTextSlot);

export default router;
