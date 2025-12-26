// routes/foodcategorymanagerAdRouter.js
import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import crypto from "crypto";

import {
  getSlot,
  saveSlot,
  deleteSlot,
  searchStore, // ✅ store_info 전용으로 컨트롤러에서 처리
  fixLinks,
  checkLinks,
} from "../controllers/foodcategorymanagerAdController.js";

const router = express.Router();

const UPLOAD_DIR = process.env.UPLOAD_DIR || "/data/uploads";
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

// ✅ image / slotImage 둘 다 허용 + saveSlot(req.file) 호환
const uploadSlot = upload.fields([
  { name: "image", maxCount: 1 },
  { name: "slotImage", maxCount: 1 },
]);

// ✅ 디버그(라우터가 살아있는지 확인용)
router.get("/debug/ping", (_req, res) => {
  res.json({ ok: true, router: "foodcategorymanager/ad" });
});

router.get("/slot", getSlot);

router.post(
  "/slot",
  uploadSlot,
  (req, _res, next) => {
    const f =
      (req.files?.image && req.files.image[0]) ||
      (req.files?.slotImage && req.files.slotImage[0]) ||
      null;

    if (f) req.file = f;
    next();
  },
  saveSlot
);

router.delete("/slot", deleteSlot);

// ✅ 가게 검색(푸드 카테고리 매니저는 store_info만)
router.get("/search-store", searchStore);

// (기존 호환)
router.get("/store/search", searchStore);

// ✅ 링크 수정/점검
router.post("/fix-links/:tableSource", fixLinks);
router.get("/check-links", checkLinks);

export default router;
