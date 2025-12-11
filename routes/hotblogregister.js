// routes/hotblogregister.js
import { Router } from "express";
import multer from "multer";
import path from "path";
import * as ctrl from "../controllers/hotblogregisterController.js";

const router = Router();

// ✅ 핫블로그 전용 업로드 디렉터리 (실제 서버 경로)
const HOTBLOG_DIR = "/data/uploads/hotblog";

// ✅ 파일 저장 방식 설정: /data/uploads/hotblog/랜덤이름.확장자
const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, HOTBLOG_DIR);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname) || "";
    const base = path.basename(file.originalname, ext).replace(/\s+/g, "_");
    const unique =
      Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
    cb(null, `${unique}${ext}`);
  },
});

// ✅ 이 업로더를 사용해서 req.files 에 파일이 담김
const upload = multer({ storage });

// 부팅 시 export 확인(로그에 registerHotBlog/getHotBlog가 보여야 정상)
console.log("[hotblog routes] exports:", Object.keys(ctrl));

router.post("/register", upload.any(), ctrl.registerHotBlog);
router.get("/:id", ctrl.getHotBlog);

export default router;
