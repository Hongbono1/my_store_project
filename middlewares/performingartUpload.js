import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = path.join(__dirname, "../public/uploads/performingart");

// 디렉토리 생성
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log("📁 performingart 업로드 폴더 생성됨:", uploadDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const sanitized = file.originalname.replace(/[^a-zA-Z0-9.\-_가-힣]/g, "_");
    cb(null, uniqueSuffix + "-" + sanitized);
  },
});

export const performingartUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});
