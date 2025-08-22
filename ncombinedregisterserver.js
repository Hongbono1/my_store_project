// ncombinedregisterserver.js
import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import combinedRouter from "./ncombinedregister.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// 미들웨어
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 업로드 파일 제공
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// 라우터 등록
app.use("/store", combinedRouter);

// 서버 실행
app.listen(PORT, () => {
  console.log(`✅ ncombinedregister server running on http://localhost:${PORT}`);
});
