// routes/foodregister.js
import express from "express";
import { upload } from "../middlewares/upload.js";
import {
  registerFood,
  getStoreFull,      // 추가
  getCombinedFull    // 추가
} from "../controllers/foodregisterController.js";

const router = express.Router();

/* 업로드 받을 필드 정의 (호환 포함) */
const fieldsDef = [
  { name: "storeImages", maxCount: 10 },
  { name: "storeImages[]", maxCount: 10 },
  { name: "menuImage", maxCount: 200 },
  { name: "menuImage[]", maxCount: 200 },
  { name: "businessCertImage", maxCount: 1 },
];

/* 업로드 저장소 보장 */
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

/* multer 설정 */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
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

// 🔽 ndetail.html용 상세 조회 라우트 추가
router.get("/:id/full", getStoreFull);

export default router;
