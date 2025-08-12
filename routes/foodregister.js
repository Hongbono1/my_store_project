// routes/foodregister.js
import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import {
  createFoodRegister,
  getFoodRegisterDetail,
  getFoodRegisterMenus,
} from "../controllers/foodregisterController.js";

const router = Router();

// 업로드 디렉토리: public2/uploads (고정)
const uploadDir = path.join(process.cwd(), "public2", "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const original = file.originalname || "file";
    const safe = original.replace(/[^\w.-]/g, "_");
    cb(null, `${Date.now()}-${safe}`);
  },
});
const upload = multer({ storage });

// ✅ 폼 name 고정 (foodregister 기준)
const uploads = upload.fields([
  { name: "storeImages", maxCount: 3 },     // 대표 이미지(여러 장)
  { name: "menuImage[]", maxCount: 200 },   // 메뉴 이미지(여러 장)
  { name: "businessCertImage", maxCount: 1 } // 사업자등록증(선택)
]);

// 생성
router.post("/", uploads, createFoodRegister);

// 상세/메뉴
router.get("/:id", getFoodRegisterDetail);
router.get("/:id/menus", getFoodRegisterMenus);

export default router;
