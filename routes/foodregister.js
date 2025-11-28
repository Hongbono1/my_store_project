// routes/foodregister.js
import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import * as ctrl from "../controllers/foodregisterController.js";

const router = Router();

/* 업로드 받을 필드 정의 (호환 포함) */
const fieldsDef = [
  { name: "storeImages", maxCount: 10 },
  { name: "storeImages[]", maxCount: 10 },
  { name: "menuImage", maxCount: 200 },
  { name: "menuImage[]", maxCount: 200 },
  { name: "businessCertImage", maxCount: 1 },
];

/* ✅ 업로드 저장소: 영구 폴더 (/data/uploads) */
const UPLOAD_ROOT = "/data/uploads";

// 폴더 보장
if (!fs.existsSync(UPLOAD_ROOT)) {
  fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
}

/* multer 설정 */
const storage = multer.diskStorage({
  // ✅ 실제 파일은 /data/uploads 에 저장
  destination: (_req, _file, cb) => cb(null, UPLOAD_ROOT),

  // 파일명: 타임스탬프 + 랜덤값 + 원본 확장자
  filename: (_req, file, cb) => {
    const ext = (path.extname(file?.originalname || "") || ".jpg").toLowerCase();
    const base = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    cb(null, `${base}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB
    files: 200,
    fields: 2000,
    parts: 2300,
  },
});

/* multer 에러 핸들링 래퍼 */
const uploadWithCatch = (req, res, next) => {
  const mw = upload.fields(fieldsDef);
  mw(req, res, (err) => {
    if (!err) return next();
    console.error("[upload]", req?.id, err);
    const status = err?.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    return res.status(status).json({
      ok: false,
      error: "upload_error",
      code: err?.code,
      field: err?.field,
      message: err?.message,
      reqId: req?.id,
    });
  });
};

/* === 라우트 ===
 * server.js에서 /store 프리픽스로 마운트되므로,
 * 여기서는 프리픽스 붙이지 말 것!
 */
router.post("/", uploadWithCatch, ctrl.createFoodStore);

// ✅ 상세 조회: 최종 경로는 /store/:id/full
router.get("/:id/full", ctrl.getFoodStoreFull);

export default router;
