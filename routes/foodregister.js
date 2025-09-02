// routes/foodregister.js
import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import * as ctrl from "../controllers/foodregisterController.js";

const router = Router();

/* ⬇️ 추가: 업로드 받을 필드 정의 */
const storeImageFields = [
  { name: "storeImages", maxCount: 10 },  // ← 폼에서 실제로 이 이름을 씀
  { name: "storeImages[]", maxCount: 10 },  // ← 호환
];
const menuImageFields = [
  { name: "menuImage", maxCount: 20 },  // ← 혹시 단수 이름으로 오는 경우
  { name: "menuImage[]", maxCount: 20 },  // ← 권장/호환
];
const otherFileFields = [
  { name: "businessCertImage", maxCount: 1 }, // ← 폼에 존재
];

/* 업로드 저장소 보장 */
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

/* multer 설정 */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    // ✅ 한글/특수문자/공백 상관없이 항상 ASCII 안전 파일명으로 저장
    const ext = (path.extname(file?.originalname || "") || ".jpg").toLowerCase();
    const base = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    cb(null, `${base}${ext}`); // 예: 1755222499699_abc123.jpg
  },
});

const upload = multer({
  storage,
  // 메뉴 행/텍스트가 많을 수 있으므로 fields/parts 한도도 넉넉히
  limits: {
    fileSize: 20 * 1024 * 1024, // 파일 1개 최대 20MB
    files: 200,                 // 전체 파일 수
    fields: 2000,               // 파일 아닌 필드 수
    parts: 2300,                // 파일 + 필드 합
  },
});

// ⬇️ fields 정의 병합
const fieldsDef = [...storeImageFields, ...menuImageFields, ...otherFileFields];

// ⬇️ multer 에러를 잡아 4xx로 JSON 반환하는 래퍼
const uploadWithCatch = (req, res, next) => {
  const mw = upload.fields(fieldsDef);
  mw(req, res, (err) => {
    if (!err) return next();
    // MulterError 예시: LIMIT_FILE_SIZE, LIMIT_FILE_COUNT, LIMIT_PART_COUNT, Unexpected field 등
    console.error("[upload]", req?.id, err);
    const status =
      err?.code === "LIMIT_FILE_SIZE" ? 413 : 400; // 파일 크기 초과는 413, 그 외 400
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


/* Routes */
router.post(
  "/",
  uploadWithCatch,
  ctrl.createFoodStore
);

router.get("/:id", ctrl.getFoodStoreById);
router.get("/store/:id/full", ctrl.getFoodRegisterFull);
router.put(
  "/:id",
  uploadWithCatch,
  ctrl.updateFoodStore
);

export default router;
