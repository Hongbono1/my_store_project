// routes/foodregister.js
import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import * as ctrl from "../controllers/foodregisterController.js";

const router = Router();

/* ------------------------------------------------------------------
 * 1) 업로드 받을 필드 정의 (현재 폼 구조와 호환)
 * ------------------------------------------------------------------ */
const fieldsDef = [
  { name: "storeImages", maxCount: 10 },
  { name: "storeImages[]", maxCount: 10 }, // 혹시 []로 오는 경우 대비
  { name: "menuImage", maxCount: 200 },
  { name: "menuImage[]", maxCount: 200 },
  { name: "businessCertImage", maxCount: 1 },
];

/* ------------------------------------------------------------------
 * 2) 업로드 저장소 경로 (서버 공통: /data/uploads)
 *    - server.js 의 UPLOAD_ROOT = "/data/uploads" 와 동일하게 맞춤
 * ------------------------------------------------------------------ */
const UPLOAD_ROOT = "/data/uploads";

// 디렉터리 보장
if (!fs.existsSync(UPLOAD_ROOT)) {
  console.log("📁 [foodregister] create upload dir:", UPLOAD_ROOT);
  fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
} else {
  console.log("📁 [foodregister] upload dir exists:", UPLOAD_ROOT);
}

/* ------------------------------------------------------------------
 * 3) multer 저장소 설정
 * ------------------------------------------------------------------ */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_ROOT);
  },
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

/* ------------------------------------------------------------------
 * 4) multer 에러 핸들링 래퍼
 * ------------------------------------------------------------------ */
const uploadWithCatch = (req, res, next) => {
  const mw = upload.fields(fieldsDef);
  mw(req, res, (err) => {
    if (!err) return next();

    console.error("[upload][foodregister]", req?.id, err);
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

/* ------------------------------------------------------------------
 * 5) 라우트
 *    - server.js 에서 /store 로 마운트되므로 여기서는 "/" 부터만
 * ------------------------------------------------------------------ */

// 등록
router.post("/", uploadWithCatch, ctrl.createFoodStore);

// 상세 조회: 최종 경로는 /store/:id/full
router.get("/:id/full", ctrl.getFoodStoreFull);

// 필요 시 다른 라우트도 여기 추가 (예: 수정 등)

export default router;
