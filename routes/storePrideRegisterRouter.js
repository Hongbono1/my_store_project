// routes/storePrideRegisterRouter.js
import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { createStorePrideRegisterController } from "../controllers/storePrideRegisterController.js";

/**
 * server.js 에서:
 * app.use("/api/storeprideregister", makeStorePrideRegisterRouter(pool));
 */
export function makeStorePrideRegisterRouter(pool) {
  const router = Router();

  const UPLOAD_DIR = "/data/uploads/storepride";
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase();
      cb(null, `${Date.now()}-${randomUUID()}${ext}`);
    },
  });

  const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
      if (!file.mimetype?.startsWith("image/")) {
        return cb(new Error("이미지 파일만 업로드 가능합니다."));
      }
      cb(null, true);
    },
  });

  const { registerStorePrideRegister, getStorePrideRegisterDetail } =
    createStorePrideRegisterController(pool);

  // 등록
  router.post("/register", upload.any(), registerStorePrideRegister);

  // 상세
  router.get("/:id(\\d+)", getStorePrideRegisterDetail);

  return router;
}
