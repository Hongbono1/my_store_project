// routes/foodregister.js
import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  createFoodRegister,
  getFoodRegisterDetail,
  getFoodRegisterMenus,
} from "../controllers/foodregisterController.js";

const router = express.Router();

// 업로드 디렉토리: public2/uploads  ← 정적 루트와 일치!
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(process.cwd(), "public2", "uploads");
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

// HTML에서 사용하는 정확한 필드명 3개만 허용
const uploads = upload.fields([
  { name: "storeImages", maxCount: 3 },
  { name: "menuImage[]", maxCount: 200 },
  { name: "businessCertImage", maxCount: 1 },
]);

// 생성
router.post("/", uploads, createFoodRegister);

// 조회
router.get("/:id", getFoodRegisterDetail);
router.get("/:id/menus", getFoodRegisterMenus);

export default router;
