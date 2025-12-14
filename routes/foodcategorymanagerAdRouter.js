// routes/foodcategorymanagerAdRouter.js
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";

import {
  getSlot,
  saveSlot,
  deleteSlot,
  searchStore,
} from "../controllers/foodcategorymanagerAdController.js";

const router = express.Router();

const UPLOAD_ROOT = process.env.UPLOAD_ROOT || "/data/uploads";
const ADS_DIR = path.join(UPLOAD_ROOT, "ads");

try { fs.mkdirSync(ADS_DIR, { recursive: true }); } catch {}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, ADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase() || ".png";
    const name = `${Date.now()}-${crypto.randomUUID()}${ext}`;
    cb(null, name);
  },
});

const upload = multer({ storage });

// ✅ API 경로는 기존 그대로 유지: /manager/ad/...
router.get("/slot", getSlot);
router.post("/slot", upload.single("image"), saveSlot);
router.delete("/slot", deleteSlot);
router.get("/store/search", searchStore);

export default router;
