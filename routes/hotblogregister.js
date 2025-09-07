import { Router } from "express";
import multer from "multer";
import * as hotblogCtrl from "../controllers/hotblogregisterController.js";

const router = Router();

// 업로드 저장 경로 (uploads/ 폴더)
const upload = multer({ dest: "uploads/" });

// 홍보 블로그 등록 (대표이미지 coverImage 1장)
router.post("/register", upload.single("coverImage"), hotblogCtrl.registerHotBlog);

// 홍보 블로그 상세 조회
router.get("/:id", hotblogCtrl.getHotBlog);

export default router;
