// routes/categoryAdRouter.js
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import {
  getFoodCategories,
  createFoodCategory,
  deleteFoodCategory,
  saveCategoryBanner,
  assignStoreToSlot, // ✅ assignStoreSlot → assignStoreToSlot로 수정
  saveTextSlot,
} from "../controllers/categoryAdController.js";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = path.join(__dirname, "..", "public", "uploads", "category_ad");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ts = Date.now();
    const rnd = Math.random().toString(36).substring(2, 8);
    const ext = path.extname(file.originalname);
    cb(null, `${ts}_${rnd}${ext}`);
  },
});
const upload = multer({ storage });

// FOOD CATEGORY CRUD
router.get("/api/food-categories", getFoodCategories);
router.post("/api/food-categories", express.json(), createFoodCategory);
router.delete("/api/food-categories/:id", deleteFoodCategory);

// 배너 업로드
router.post("/category/ad/upload", upload.single("image"), saveCategoryBanner);

// 가게 지정
router.post("/category/ad/store", upload.none(), assignStoreToSlot); // ✅ 수정

// 텍스트 저장
router.post("/category/ad/text/save", express.json(), saveTextSlot);

export default router;
