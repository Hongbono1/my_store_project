// routes/market.js
import express from "express";
import multer from "multer";
import path from "path";
import {
  createMarket,
  getMarketById,
  getAllMarkets,
} from "../controllers/marketController.js";

/* ───────────────── Multer 설정 ───────────────── */
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
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// 서버가 허용하는 파일 필드 목록
const fileFields = [
  { name: "main_img", maxCount: 1 },
  { name: "parking_img", maxCount: 1 },
  { name: "transport_img", maxCount: 1 },
  { name: "q1_image", maxCount: 1 },
  { name: "q2_image", maxCount: 1 },
  { name: "q3_image", maxCount: 1 },
  { name: "q4_image", maxCount: 1 },
  { name: "q5_image", maxCount: 1 },
  { name: "q6_image", maxCount: 1 },
  { name: "q7_image", maxCount: 1 },
  { name: "q8_image", maxCount: 1 },
  { name: "customq1_image", maxCount: 1 },
  { name: "customq2_image", maxCount: 1 },
  { name: "customq3_image", maxCount: 1 },
  { name: "customq4_image", maxCount: 1 },
  { name: "customq5_image", maxCount: 1 },
  { name: "customq6_image", maxCount: 1 },
  { name: "customq7_image", maxCount: 1 },
  { name: "customq8_image", maxCount: 1 },
];

// Multer 에러 처리 래퍼
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

/* ───────────────── Router ───────────────── */
const router = express.Router();

/** 디버그용: 어떤 필드가 오는지 확인 (/:id보다 위에 둬야 함) */
router.post("/_debug_files", upload.any(), (req, res) => {
  const fileNames = (req.files || []).map((f) => f.fieldname);
  console.log("FILES >>>", fileNames);
  console.log("BODY  >>>", Object.keys(req.body));
  res.json({ ok: true, files: fileNames, bodyKeys: Object.keys(req.body) });
});

/** POST /market - 전통시장 등록 */
router.post("/", multerFieldsMiddleware, createMarket);

/** GET /market/:id - 단일 시장 조회 */
router.get("/:id", getMarketById);

/** GET /market - 전체 시장 목록 */
router.get("/", getAllMarkets);

export default router;
