// uploads/multer.js
import multer from "multer";
import path from "node:path";
import { existsSync, mkdirSync } from "node:fs";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });

function safeName(original = "") {
  const ext = (path.extname(original) || ".jpg").toLowerCase();
  const base = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return `${base}${ext}`; // ASCII만 사용
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, safeName(file?.originalname)),
});

export const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});
