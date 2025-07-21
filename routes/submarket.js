import express from "express";
import multer from "multer";
import path from "path";
import { createSubmarket } from "../controllers/submarketController.js";

const router = express.Router();
const upload = multer({ dest: path.join(process.cwd(), "public", "uploads/") });

// 시장 등록 (이미지 포함)
router.post("/register", upload.fields([
  { name: "main_img", maxCount: 1 },
  { name: "parking_img", maxCount: 1 },
  { name: "transport_img", maxCount: 1 }
  // 고정질문/자유질문 이미지도 필요시 추가
]), createSubmarket); // ← 이름 통일!

export default router;


