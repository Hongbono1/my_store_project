import { Router } from "express";
import multer from "multer";
import path from "path";
import * as hotblogController from "../controllers/hotblogController.js";

const router = Router();

/* 파일 업로드 설정 */
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, "uploads"),
    filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

/* 블로그 등록 */
router.post(
    "/register",
    upload.any(), // coverImage + q&a 이미지들
    hotblogController.registerHotBlog
);

export default router;
