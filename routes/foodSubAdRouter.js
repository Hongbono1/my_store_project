// routes/foodSubAdRouter.js
import express from "express";
import multer from "multer";
import path from "path";
import { 
  uploadSubAd, 
  getSubSlot,
  getFoodSubcategoryStores 
} from "../controllers/foodSubAdController.js";

const router = express.Router();

const UPLOAD_ROOT = "/data/uploads";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_ROOT);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + "_" + Math.random().toString(36).slice(2, 8);
    const ext = path.extname(file.originalname);
    cb(null, unique + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

// 서브카테고리 가게 목록
router.get("/:type", getFoodSubcategoryStores);

// 광고 슬롯 관리
router.post("/ad/upload", upload.single("image"), uploadSubAd);
router.get("/ad/slot", getSubSlot);

export default router;
