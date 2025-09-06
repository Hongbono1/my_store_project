import { Router } from "express";
import * as hotblogCtrl from "../controllers/hotblogregisterController.js"; // ✅ 파일명 맞춤

const router = Router();

// 홍보 블로그 등록
router.post("/register", hotblogCtrl.registerHotBlog);

// 홍보 블로그 상세 조회
router.get("/:id", hotblogCtrl.getHotBlog);

export default router;
