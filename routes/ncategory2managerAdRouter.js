// routes/ncategory2managerAdRouter.js
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
} from "../controllers/ncategory2managerAdController.js";

const router = express.Router();

// ✅ ncategory2 전용 업로드 폴더
const UPLOAD_ROOT = process.env.UPLOAD_DIR || "/data/uploads";
const UPLOAD_DIR = path.join(UPLOAD_ROOT, "ncategory2_ad");
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
router.get("/store/search", searchStore);

export default router;
