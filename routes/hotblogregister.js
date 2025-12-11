// routes/hotblogregisterRouter.js
import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import * as ctrl from "../controllers/hotblogregisterController.js";

const router = Router();

// 🔹 업로드 기본 경로
const UPLOAD_ROOT = "/data/uploads";
const HOTBLOG_DIR = path.join(UPLOAD_ROOT, "hotblog");

// 폴더 없으면 생성
if (!fs.existsSync(HOTBLOG_DIR)) {
  fs.mkdirSync(HOTBLOG_DIR, { recursive: true });
  console.log("[hotblog uploads] created dir:", HOTBLOG_DIR);
} else {
  console.log("[hotblog uploads] dir exists:", HOTBLOG_DIR);
}

// 🔹 multer 저장 설정
const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, HOTBLOG_DIR);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname || "");
    const base = path.basename(file.originalname || "img", ext);
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `${unique}-${base}${ext}`);
  },
});

const upload = multer({ storage });

// 부팅 시 export 확인
console.log("[hotblog routes] exports:", Object.keys(ctrl));

/**
 * POST /api/hotblog/register
 *  - 대표 이미지 + 질문별 이미지 + 기본 정보
 */
router.post("/register", upload.any(), ctrl.registerHotBlog);

/**
 * GET /api/hotblog/:id
 *  - 상세 조회 (hotblogdetail.html 에서 사용)
 */
router.get("/:id", ctrl.getHotBlog);

export default router;
