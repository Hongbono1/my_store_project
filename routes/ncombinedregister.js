// routes/ncombinedregister.js
import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import * as ctrl from "../controllers/ncombinedregisterController.js";

const router = Router();

// 업로드 폴더 보장
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// multer 저장 설정
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + "_" + file.originalname.replace(/\s+/g, "_");
    cb(null, unique);
  },
});
const upload = multer({ storage });

// 등록 라우트
router.post(
  "/store",
  upload.fields([
    { name: "storeImages", maxCount: 10 },
    { name: "menuImage[]", maxCount: 50 },
    { name: "businessCertImage", maxCount: 1 },
  ]),
  ctrl.createStore
);

export default router;
