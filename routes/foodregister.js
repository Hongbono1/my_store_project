// routes/foodregister.js
import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";

import {
  createFoodRegister,
  getFoodRegisterDetail,
  getFoodRegisterFull,
} from "../controllers/foodregisterController.js";

const router = express.Router();

/** ───────── 파일 업로드 설정 ───────── **/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ★ server.js가 /uploads -> public2/uploads 를 서빙하므로 동일하게 저장
const uploadDir = path.join(process.cwd(), "public2", "uploads");

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^\w.-]+/g, "_");
    cb(null, `${Date.now()}_${base}${ext}`);
  },
});
const upload = multer({ storage });

// 프론트 필드명과 반드시 동일하게
const uploadFields = upload.fields([
  { name: "storeImages", maxCount: 10 },     // 대표 이미지들
  { name: "menuImage[]", maxCount: 50 },     // 메뉴 이미지들
  { name: "businessCertImage", maxCount: 1 } // 사업자증빙 이미지
]);

/** ───────── 라우팅 ───────── **/
// 등록
router.post("/", uploadFields, createFoodRegister);

// 단건 요약
router.get("/:id", getFoodRegisterDetail);

// ★ 풀데이터 (ndetail.html이 호출하는 경로)
router.get("/:id/full", getFoodRegisterFull);

export default router;
