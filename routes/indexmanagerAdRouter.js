// routes/indexmanagerAdRouter.js
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

import {
  // ✅ 업로드/저장
  uploadIndexAd,
  saveIndexStoreAd,
  connectStoreToSlot, // ✅ 라우터가 찾던 export

  // ✅ 조회
  getIndexSlot,
  getIndexTextSlot,
  getBestPickSlots,
  searchStoreByBiz,

  // ✅ 저장(텍스트)
  saveIndexTextSlot,

  // ✅ 삭제
  deleteSlot,
} from "../controllers/indexmanagerAdController.js";

const router = express.Router();

/* ============================================================
 * ✅ 업로드 설정
 * - indexmanager에서 배너 업로드가 필요할 때만 사용
 * - 파일 필드명은 프론트에서 보내는 이름에 맞춰야 함
 *   (일반적으로 "image" 또는 "file")
 * ============================================================ */
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    const base = path.basename(file.originalname || "ad", ext);
    const safeBase = base.replace(/[^\w\-]/g, "_");
    cb(null, `${Date.now()}-${safeBase}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

/* ============================================================
 * ✅ Routes
 * ============================================================ */

// 1) 이미지/배너 업로드
// - 프론트가 "image"로 보내면 upload.single("image")
// - 혹시 "file"로 보내는 경우도 흔해서 안전하게 2개 지원
router.post(
  "/upload",
  (req, res, next) => {
    // fieldname 유연 대응
    const handler =
      req.headers["x-upload-field"] === "file"
        ? upload.single("file")
        : upload.single("image");
    handler(req, res, (err) => {
      if (err) return res.status(400).json({ ok: false, message: err.message });
      next();
    });
  },
  uploadIndexAd
);

// 2) 기존 방식: 가게 연결 저장
router.post("/store", saveIndexStoreAd);

// 3) 신규/보강 방식: 가게 연결 저장
router.post("/store/connect", connectStoreToSlot);

// 4) 사업자번호 기반 가게 검색
router.get("/store/search", searchStoreByBiz);

// 5) 슬롯 단건 조회 (store 모드 보강 포함)
router.get("/slot", getIndexSlot);

// 6) 텍스트 슬롯 단건 조회
router.get("/text/get", getIndexTextSlot);

// 7) 텍스트 슬롯 저장
router.post("/text/save", saveIndexTextSlot);

// 8) Best Pick 목록 제공
router.get("/best-pick", getBestPickSlots);

// 9) 슬롯 삭제
router.delete("/slot", deleteSlot);

export default router;
