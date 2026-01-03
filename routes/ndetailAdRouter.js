// routes/ndetailAdRouter.js
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";

import {
  UPLOAD_ABS_DIR,
  getSlot,
  upsertSlot,
  deleteSlot,
  searchStore,
} from "../controllers/ndetailmanagerAdController.js";

const router = express.Router();

// multer storage (컨트롤러의 업로드 폴더 그대로)
function ensureDir() {
  fs.mkdirSync(UPLOAD_ABS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureDir();
    cb(null, UPLOAD_ABS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    cb(null, `${Date.now()}_${crypto.randomUUID()}${ext}`);
  },
});

function fileFilter(req, file, cb) {
  const ok = /^image\//.test(file.mimetype || "");
  if (!ok) return cb(new Error("Only image files are allowed"));
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 },
});

const uploadSingleImage = upload.single("image");

// API
router.get("/slot", getSlot);
router.post("/update", uploadSingleImage, upsertSlot);
router.delete("/delete", deleteSlot);

router.get("/search-store", searchStore);

export default router;
