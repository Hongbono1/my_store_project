import { Router } from "express";
import multer from "multer";
import * as ctrl from "../controllers/hotblogregisterController.js"; // ← 안전

const router = Router();
const upload = multer({ dest: "uploads/" });

// 부팅 시 export 확인(로그에 registerHotBlog/getHotBlog가 보여야 정상)
console.log("[hotblog routes] exports:", Object.keys(ctrl));

router.post("/register", upload.any(), ctrl.registerHotBlog);
router.get("/:id", ctrl.getHotBlog);

export default router;
