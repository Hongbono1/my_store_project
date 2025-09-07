// routes/hotblogregister.js
import { Router } from "express";
import multer from "multer";
import * as ctrl from "../controllers/hotblogregisterController.js";

const router = Router();
const upload = multer({ dest: "uploads/" });

console.log("[hotblog routes] exports:", Object.keys(ctrl)); // 시작시 확인

router.post("/register", upload.any(), ctrl.registerHotBlog);
router.get("/:id", ctrl.getHotBlog);

export default router;
