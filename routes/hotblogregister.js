// routes/hotblogregister.js
import { Router } from "express";
import multer from "multer";
import * as ctrl from "../controllers/hotblogregisterController.js"; // ← 안전

const router = Router();
const upload = multer({ dest: "uploads/" });

// 디버그: 실제 export 확인 (prod에선 생략해도 OK)
console.log("[hotblog routes] exports:", Object.keys(ctrl));

router.post("/register", upload.any(), ctrl.registerHotBlog);
router.get("/:id", ctrl.getHotBlog);

export default router;
