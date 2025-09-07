import { Router } from "express";
import multer from "multer";
import * as ctrl from "../controllers/hotblogregisterController.js"; // ← 네임스페이스 import

const router = Router();
const upload = multer({ dest: "uploads/" });

// 부팅 시 실제 export 확인 (로그에서 'registerHotBlog','getHotBlog' 보여야 정상)
console.log("[hotblog routes] exports:", Object.keys(ctrl));

router.post("/register", upload.any(), ctrl.registerHotBlog);
router.get("/:id", ctrl.getHotBlog);

export default router;
