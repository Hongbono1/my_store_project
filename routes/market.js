// routes/market.js
import express from "express";
import multer from "multer";
import path from "path";
import pool from "../db.js"; // 반드시 pool import!
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
  // 고정질문 이미지 (q1_image ~ q8_image)
  ...Array.from({ length: 8 }, (_, i) => ({ name: `q${i + 1}_image`, maxCount: 1 })),
  // 자유질문 이미지 (customq1_image ~ customq8_image)
  ...Array.from({ length: 8 }, (_, i) => ({ name: `customq${i + 1}_image`, maxCount: 1 })),
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

const router = express.Router();

/* ─────────── [1] 마켓 리스트 (카드 컨테이너용) ─────────── */
// GET /market/list?pageSize=8
router.get("/list", async (req, res) => {
  try {
    const pageSize = parseInt(req.query.pageSize, 10) || 8;
    const sql = `SELECT id, market_name, main_img, address, phone FROM market_info ORDER BY id DESC LIMIT $1`;
    const { rows } = await pool.query(sql, [pageSize]);
    // 프론트 카드 필드(name, img) 맞춰줌
    const mapped = rows.map(m => ({
      ...m,
      name: m.market_name,
      img: m.main_img
    }));
    res.json(mapped);
  } catch (err) {
    console.error("[GET /market/list]", err);
    res.status(500).json({ success: false, error: "DB 조회 실패" });
  }
});

/* ─────────── 디버그: 전송된 파일 필드 체크 ─────────── */
router.post("/_debug_files", upload.any(), (req, res) => {
  const fileNames = (req.files || []).map((f) => f.fieldname);
  res.json({ ok: true, files: fileNames, bodyKeys: Object.keys(req.body) });
});

/* ─────────── 등록/상세/전체 ─────────── */
router.post("/", multerFieldsMiddleware, createMarket);
router.get("/:id", getMarketById);
router.get("/", getAllMarkets);

export default router;
