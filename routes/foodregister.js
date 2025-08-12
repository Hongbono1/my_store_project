// routes/foodregister.js  (foodregister.html 전용)
import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  createFoodStore,
  getFoodStoreDetail,
  getFoodStoreMenus,
} from "../controllers/foodregisterController.js";

const router = express.Router();

// 업로드 디렉토리 준비
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(process.cwd(), "public", "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Multer 저장 정책
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    const base = path.basename(file.originalname || "file", ext);
    const safeBase = base.replace(/[^\w.-]+/g, "_");
    cb(null, `${Date.now()}_${Math.random().toString(36).slice(2)}_${safeBase}${ext}`);
  },
});
const upload = multer({ storage });

/**
 * foodregister.html 폼 기준
 * - 대표 이미지: name="storeImages" multiple (최대 3)
 * - 메뉴 이미지: name="menuImage[]" multiple
 * - 사업자등록증: name="businessCertImage" (선택)
 * - 텍스트 필드: req.body
 */
const uploads = upload.fields([
  { name: "storeImages", maxCount: 3 },
  { name: "menuImage[]", maxCount: 200 },
  { name: "menuImage", maxCount: 200 },         // [] 없이 오는 경우 대비
  { name: "businessCertImage", maxCount: 1 },   // 선택
]);

// 생성 (foodregister.html 전용)
router.post("/", uploads, createFoodStore);

// 상세/메뉴 (ndetail.html에서 재사용)
router.get("/:id", getFoodStoreDetail);
router.get("/:id/menus", getFoodStoreMenus);

export default router;
