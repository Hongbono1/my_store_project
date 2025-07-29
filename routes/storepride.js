// routes/storepride.js
import express from "express";
import multer from "multer";
import path from "path";
import {
  insertStorePride,
  getStorePrideById,
  getStorePrideList
} from "../controllers/storeprideController.js";

const router = express.Router();

// multer storage: 파일명에 랜덤값+타임스탬프+확장자
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/uploads");
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const basename = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, basename + ext);
  }
});
const upload = multer({ storage });

// 등록폼의 파일필드 모두 정의
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

// 1. 가게자랑 등록 (이미지 포함)
router.post("/register", upload.fields(fileFields), insertStorePride);

// 2. 가게자랑 리스트 (최신순, 8개) - 메인 노출
router.get("/list", getStorePrideList);

// **아래 추가** GET /storepride/api?pageSize=8 로도 받을 수 있게
router.get("/api", getStorePrideList);

router.get("/",    getStorePrideList);   // storepride.html 에서 쓰는 루트 호출 대응

// 3. pride_id로 상세 조회
router.get("/:id", getStorePrideById);

export default router;
