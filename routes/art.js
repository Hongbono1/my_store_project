import express from "express";
import multer from "multer";
import path from "path";
import {
  registerArt,
  getArtById,
  getArtListByCategory
} from "../controllers/artController.js";

const router = express.Router();

// 파일 업로드 설정
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, path.join(process.cwd(), "public/uploads/")),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, base + ext);
  }
});
const upload = multer({ storage });

// 등록 (POST)
router.post(
  "/",
  upload.fields([
    { name: "images", maxCount: 3 },
    { name: "pamphlet", maxCount: 6 }
  ]),
  registerArt
);

// 상세조회 (GET /api/art/:id)
router.get("/:id", getArtById);

// 🎤 공연 일정 (GET /api/events)
router.get("/events", (req, res) => getArtListByCategory(req, res, "공연"));

// 🎨 예술 전시 (GET /api/arts)
router.get("/arts", (req, res) => getArtListByCategory(req, res, "예술"));

// 🎸 버스커 공연 (GET /api/buskers)
router.get("/buskers", (req, res) => getArtListByCategory(req, res, "버스커"));

export default router;
