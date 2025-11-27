// routes/foodregister.js
import express from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import {
  registerFood,      // 등록
  getStoreFull       // 상세 조회
} from "../controllers/foodregisterController.js";

const router = express.Router();

/* 업로드 받을 필드 정의 */
const fieldsDef = [
  { name: "storeImages", maxCount: 10 },
  { name: "storeImages[]", maxCount: 10 },
  { name: "menuImage", maxCount: 200 },
  { name: "menuImage[]", maxCount: 200 },
  { name: "businessCertImage", maxCount: 1 },
];

/* 업로드 폴더 보장 */
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

/* multer 설정 */
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) => {
    const ext = (path.extname(file?.originalname || "") || ".jpg").toLowerCase();
    const base = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    cb(null, `${base}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024,
    files: 200,
    fields: 2000,
    parts: 2300,
  },
});

/* 업로드 에러 래퍼 */
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

/* 💥 라우터 등록 (server.js에서 /store 프리픽스 붙음) */
router.post("/", uploadWithCatch, registerFood);

/* 🔥 ndetail.html 상세 조회 */
router.get("/:id/full", getStoreFull);

export default router;
