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

/* ============================================================
 * 업로드 저장 경로: /data/uploads (환경변수 UPLOAD_ROOT 허용)
 * 서버.js에는 반드시:
 *   app.use("/uploads", express.static("/data/uploads"));
 * 가 있어야 브라우저에서 /uploads/* 로 접근 가능
 * ============================================================ */
const UPLOAD_ROOT = process.env.UPLOAD_ROOT || "/data/uploads";

// 폴더 보장
try {
  fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
  // 하위 폴더를 쓰고 싶다면 여기서 추가 생성 가능
  // fs.mkdirSync(path.join(UPLOAD_ROOT, "admin"), { recursive: true });
} catch (e) {
  console.error("❌ 업로드 폴더 생성 실패:", e.message);
}

/* ============================================================
 * Multer 설정: 파일명/필터/용량
 * ============================================================ */
const ALLOWED_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_ROOT),
  filename: (_req, file, cb) => {
    const orig = file.originalname || "image";
    const ext0 = (path.extname(orig) || "").toLowerCase();
    const ext = ALLOWED_EXTS.has(ext0) ? ext0 : ".png";
    const stamp = Date.now();
    const rand = Math.random().toString(36).slice(2, 8);
    cb(null, `${stamp}-${rand}${ext}`);
  },
});

function fileFilter(_req, file, cb) {
  // 이미지 MIME만 허용
  if (file && typeof file.mimetype === "string" && file.mimetype.startsWith("image/")) {
    return cb(null, true);
  }
  cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", "image"));
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
});

/** Multer 에러를 JSON으로 치환하는 헬퍼 */
function safeSingle(field) {
  return (req, res, next) => {
    upload.single(field)(req, res, (err) => {
      if (!err) return next();
      // Multer 오류를 사용자 친화적으로
      if (err instanceof multer.MulterError) {
        const map = {
          LIMIT_FILE_SIZE: "파일 용량이 큽니다.",
          LIMIT_UNEXPECTED_FILE: "허용되지 않은 파일 형식이거나 필드명이 잘못되었습니다.",
          LIMIT_FILE_COUNT: "파일 개수 제한을 초과했습니다.",
        };
        return res.status(400).json({
          ok: false,
          code: "UPLOAD_ERROR",
          reason: err.code,
          message: map[err.code] || "업로드 처리 중 오류가 발생했습니다.",
        });
      }
      // 기타 에러
      return res.status(500).json({
        ok: false,
        code: "UPLOAD_ERROR",
        message: err?.message || "업로드 처리 중 서버 오류가 발생했습니다.",
      });
    });
  };
}

/* ============================================================
 * Router
 * ============================================================ */
const router = Router();

// 🟩 (배너/이미지 업로드형) 슬롯 저장
// 프론트는 FormData에 field 이름을 image 로 보낼 것
router.post("/upload", safeSingle("image"), uploadIndexAd);

// 🟧 (가게 연결형) 슬롯 저장 + 검색/연결
router.post("/store", saveIndexStoreAd);
router.get("/store/search", searchStoreByBiz);
router.post("/store/connect", connectStoreToSlot);

// 🔎 슬롯 / 텍스트
router.get("/slot", getIndexSlot);
router.get("/text/get", getIndexTextSlot);
router.post("/text/save", saveIndexTextSlot);

// ⭐ Best Pick 묶음 조회
router.get("/best-pick", getBestPickSlots);

// 🗑️ 슬롯 삭제
router.delete("/slot", deleteSlot);

export default router;
