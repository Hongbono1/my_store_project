import express from "express";
import multer from "multer";
import { insertStorePride, getStorePrideById, getStorePrideList } from "../controllers/storeprideController.js";

const router = express.Router();
const upload = multer({ dest: "public/uploads" });

// 고정질문(8개) + 자유질문(최대 5개)까지 모든 파일 필드 정의!
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

// 등록(POST) 시 여러 파일 필드를 모두 허용
router.post("/register", upload.fields(fileFields), insertStorePride);

// ➊ 리스트 조회 라우트는 ID 조회보다 위에!
router.get("/list", getStorePrideList);


// pride_id로 상세 조회(GET)
router.get("/:id", getStorePrideById);

export default router;
