// routes/ndetailAdRouter.js
import express from "express";
import multer from "multer";
import path from "path";
import crypto from "crypto";

import {
  UPLOAD_ABS_DIR,
  getSlot,
  upsertSlot,
  deleteSlot,
  searchStore,
} from "../controllers/ndetailAdController.js";

const router = express.Router();

function fileFilter(req, file, cb) {
  const ok = /^image\//.test(file.mimetype || "");
  if (!ok) return cb(new Error("이미지 파일만 업로드 가능합니다."), false);
  cb(null, true);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_ABS_DIR);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
    const name = `${Date.now()}_${crypto.randomUUID()}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 },
});

// ✅ 슬롯: 읽기/저장/삭제
router.get("/slot", getSlot);
router.post("/slot", upload.single("image"), upsertSlot);
router.delete("/slot", deleteSlot);

// ✅ 가게 검색(푸드+통합 합쳐서)
router.get("/store/search", searchStore);

export default router;
