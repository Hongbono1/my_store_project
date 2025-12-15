// routes/foodcategorymanagerRouter.js
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
} from "../controllers/foodcategorymanagerAdController.js";

const router = express.Router();

const UPLOAD_DIR = process.env.UPLOAD_DIR || "/data/uploads";
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

// ✅ image / slotImage 둘 다 허용 + 기존 saveSlot(req.file) 호환
const uploadSlot = upload.fields([
  { name: "image", maxCount: 1 },
  { name: "slotImage", maxCount: 1 },
]);

router.get("/slot", getSlot);

router.post("/slot", uploadSlot, (req, res, next) => {
  // fields 업로드일 때도 saveSlot이 req.file로 받는 경우를 위해 보정
  const f =
    (req.files?.image && req.files.image[0]) ||
    (req.files?.slotImage && req.files.slotImage[0]) ||
    null;

  if (f) req.file = f;
  next();
}, saveSlot);

router.delete("/slot", deleteSlot);

router.get("/store/search", searchStore);

export default router;
