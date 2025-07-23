// routes/market.js
import express from "express";
import multer from "multer";
import path from "path";
import {
  createMarket,
  getMarketById,
  getAllMarkets,
} from "../controllers/marketController.js";

/* ─────────── Multer 설정 ─────────── */
const uploadDir = path.join(process.cwd(), "public", "uploads");

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^\w.-]/g, "_");
    cb(null, `${Date.now()}-${base}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

// 서버가 허용하는 파일 필드
const fileFields = [
  { name: "main_img", maxCount: 1 },
  { name: "parking_img", maxCount: 1 },
  { name: "transport_img", maxCount: 1 },
  // Q&A 이미지 8개
  ...Array.from({ length: 8 }, (_, i) => ({ name: `q${i + 1}_image`, maxCount: 1 })),
];

/** Multer 에러 핸들 */
function multerFieldsMiddleware(req, res, next) {
  upload.fields(fileFields)(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError && err.code === "LIMIT_UNEXPECTED_FILE") {
      console.error("❌ Unexpected file field:", err.field);
      return res.status(400).json({
        success: false,
        error: `Unexpected file field: ${err.field}`,
      });
    }
    return next(err);
  });
}

/* ─────────── Router ─────────── */
const router = express.Router();

// 디버그용 (전송된 필드 체크)
router.post("/_debug_files", upload.any(), (req, res) => {
  const fileNames = (req.files || []).map((f) => f.fieldname);
  res.json({ ok: true, files: fileNames, bodyKeys: Object.keys(req.body) });
});

// 등록
router.post("/", multerFieldsMiddleware, createMarket);

// 단일 조회
router.get("/:id", getMarketById);

// 전체 조회
router.get("/", getAllMarkets);

export default router;
