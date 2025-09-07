import { Router } from "express";
import multer from "multer";
import { registerHotBlog, getHotBlog } from "../controllers/hotblogregisterController.js";

const router = Router();
const upload = multer({ dest: "uploads/" });

router.post("/register", upload.any(), registerHotBlog);
router.get("/:id", getHotBlog);

export default router;
