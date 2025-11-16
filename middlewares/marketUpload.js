import multer from "multer";
import path from "path";
import fs from "fs";

const marketDir = "public2/uploads/traditionalmarket";

if (!fs.existsSync(marketDir)) {
  fs.mkdirSync(marketDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, marketDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const fname = Date.now() + "-" + Math.random().toString(36).substring(2) + ext;
    cb(null, fname);
  }
});

export const marketUpload = multer({ storage });
