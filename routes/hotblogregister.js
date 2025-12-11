// routes/hotblogregister.js
import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import * as ctrl from "../controllers/hotblogregisterController.js";

const router = Router();

// ✅ 핫블로그 전용 업로드 폴더
const HOTBLOG_DIR = "/data/uploads/hotblog";

// 폴더 없으면 생성
fs.mkdirSync(HOTBLOG_DIR, { recursive: true });

// ✅ multer 설정: /data/uploads/hotblog 에 저장
const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, HOTBLOG_DIR);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname || "");
    const base = Date.now().toString(36);
    const rnd = Math.random().toString(36).slice(2, 8);
    cb(null, `${base}-${rnd}${ext || ".jpg"}`);
  },
});

const upload = multer({ storage });

// 부팅 시 export 확인
console.log("[hotblog routes] exports:", Object.keys(ctrl));

// ✅ 등록
router.post("/register", upload.any(), ctrl.registerHotBlog);

// ✅ 단일 조회 (상세 페이지에서 사용)
router.get("/:id", ctrl.getHotBlog);

export default router;
