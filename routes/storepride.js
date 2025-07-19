import express from "express";
import { insertStorePride, getStorePrideById } from "../controllers/storeprideController.js";
import multer from "multer";
const router = express.Router();

const upload = multer({ dest: "public/uploads" }); // 필요시 경로 맞춰 조정

// 대표사진만 받는 구조
router.post("/register", upload.single("main_img"), insertStorePride);

// 상세 조회 등 다른 라우터도 여기에...
// router.get("/:id", getStorePrideById);

export default router;

