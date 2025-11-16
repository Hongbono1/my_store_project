import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// public/uploads/traditionalmarket 으로 변경 (기존 볼륨 활용)
const marketDir = path.join(__dirname, "../public/uploads/traditionalmarket");

// 폴더가 없으면 자동 생성
if (!fs.existsSync(marketDir)) {
  console.log("📁 전통시장 업로드 폴더 생성:", marketDir);
  fs.mkdirSync(marketDir, { recursive: true });
} else {
  console.log("✅ 전통시장 업로드 폴더 존재:", marketDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // 업로드 시마다 폴더 존재 확인
    if (!fs.existsSync(marketDir)) {
      fs.mkdirSync(marketDir, { recursive: true });
    }
    cb(null, marketDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const fname = Date.now() + "-" + Math.random().toString(36).substring(2) + ext;
    console.log("💾 파일 저장:", fname, "→", marketDir);
    cb(null, fname);
  }
});

export const marketUpload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB 제한
});


