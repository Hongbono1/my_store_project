// routes/indexmanagerAdRouter.js
import { Router } from "express";
import multer from "multer";
import path from "path";

import {
  getSlot,
  getText,
  uploadSlot,
  saveStoreSlot,
  saveText,
} from "../controllers/indexmanagerAdController.js";

const router = Router();

// === multer 설정: public/uploads에 저장 ===
const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, "public/uploads");
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext);
    const unique = Date.now() + "_" + Math.random().toString(36).slice(2, 8);
    cb(null, `${base}_${unique}${ext}`);
  },
});

const upload = multer({ storage });

// 배너/프로모 슬롯 조회
router.get("/ad/slot", getSlot);

// 텍스트 슬롯 조회
router.get("/ad/text/get", getText);

// 배너/프로모 저장 (이미지 + 링크)
router.post("/ad/upload", upload.single("image"), uploadSlot);

// 등록된 가게 연결 모드 (사업자번호 + 상호)
router.post("/ad/store", saveStoreSlot);

// 텍스트 슬롯 저장
router.post("/ad/text/save", saveText);

export default router;
