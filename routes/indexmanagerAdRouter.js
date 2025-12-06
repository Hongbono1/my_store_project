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
} from "../controllers/indexmanagerAdController.js";

const router = express.Router();

// ✅ 서버와 동일한 업로드 루트 경로 (A 방식: /data/uploads)
const UPLOAD_ROOT = "/data/uploads";

// Multer 스토리지 설정
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // /data/uploads 에 저장 → https://www.hongbono1.com/uploads/파일명 으로 접근
    cb(null, UPLOAD_ROOT);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + "_" + Math.random().toString(36).slice(2, 8);
    const ext = path.extname(file.originalname || "");
    cb(null, unique + ext);
  },
});

// Multer 인스턴스 생성
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    // 이미지 파일만 허용
    const allowedMimes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("이미지 파일만 업로드 가능합니다."));
    }
  },
});

/* ============================
 *  인덱스 레이아웃 광고 관리 API
 *  (server.js: app.use("/manager/ad", indexmanagerAdRouter);)
 *  최종 경로 예:
 *    POST /manager/ad/upload
 *    GET  /manager/ad/slot
 *    GET  /manager/ad/text/get
 * ============================ */

// 배너/이미지 슬롯 업로드 (이미지 파일 포함)
// FormData: image + page + position + link_url + (기간필드 등)
router.post("/upload", upload.single("image"), uploadIndexAd);

// 배너/이미지 슬롯 조회 (page, position 쿼리로 조회)
router.get("/slot", getIndexSlot);

// 텍스트 슬롯 조회 (slot_type='text' 전용)
router.get("/text/get", getIndexTextSlot);

// 텍스트 슬롯 저장
router.post("/text/save", saveIndexTextSlot);

// ✅ Best Pick 광고 슬롯
router.get("/best-pick", getBestPickSlots);

export default router;
