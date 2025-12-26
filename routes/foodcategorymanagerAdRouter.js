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
  searchStore,
  fixLinks,
  checkLinks,
  debugStoreCount, // ✅ 추가
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

router.get("/slot", getSlot);
router.get("/debug-store-info", debugStoreInfo);


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

// ✅ 가게 검색 (푸드: store_info)
router.get("/store/search", searchStore);
router.get("/search-store", searchStore); // ✅ 프론트에서 쓰는 경로

// ✅ 디버그(정말 DB에 store_info가 보이는지)
router.get("/debug-store-count", debugStoreCount);

// ✅ 링크 수정 API
router.post("/fix-links/:tableSource", fixLinks);
router.get("/check-links", checkLinks);

export default router;
