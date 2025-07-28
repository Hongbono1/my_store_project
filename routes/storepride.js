import express from "express";
import multer from "multer";
import { insertStorePride, getStorePrideById, getStorePrideList } from "../controllers/storeprideController.js";
const router = express.Router();
const upload = multer({ dest: "public/uploads" });

const fileFields = [
  { name: "main_img", maxCount: 1 },
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
  { name: "customq5_image", maxCount: 1 }
];

// 가게자랑 등록
router.post("/register", upload.fields(fileFields), insertStorePride);

// 추천 가게 리스트 (조회수 순, 8개)
router.get("/list", getStorePrideList);

// pride_id로 상세 조회
router.get("/:id", getStorePrideById);

export default router;
