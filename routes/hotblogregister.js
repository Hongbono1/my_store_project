import express from "express";
import multer from "multer";
import path from "path";
import {
  registerBlog,
  getAllBlogs,
  getBlogById,
  updateBlog,
  deleteBlog,
} from "../controllers/hotblogregisterController.js";

const router = express.Router();

// ✅ A 방식: /data/uploads/hotblog
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "/data/uploads/hotblog");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
});

// 부팅 시 export 확인(로그에 registerHotBlog/getHotBlog가 보여야 정상)
console.log("[hotblog routes] exports:", Object.keys(ctrl));

router.post("/register", upload.any(), ctrl.registerHotBlog);
router.get("/:id", ctrl.getHotBlog);

export default router;
