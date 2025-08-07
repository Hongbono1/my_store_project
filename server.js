import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import multer from "multer";
import { fileURLToPath } from "url";

// __dirname (ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// ────────────────────────────────────────────────────────────
// 공통 미들웨어
// ────────────────────────────────────────────────────────────
app.use(cors({ origin: ["https://www.hongbono1.com", "http://localhost:3000"] }));
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // 멀티파트는 multer가 처리

// ────────────────────────────────────────────────────────────
/**
 * 정적 경로
 *  - /       → public
 *  - /uploads → public/uploads
 *  - /new    → public2
 */
// ────────────────────────────────────────────────────────────
app.use("/uploads", express.static(path.join(__dirname, "public", "uploads")));
app.use(express.static(path.join(__dirname, "public")));
app.use("/new", express.static(path.join(__dirname, "public2")));

// ────────────────────────────────────────────────────────────
// Multer 업로드 설정
// ────────────────────────────────────────────────────────────
const uploadDir = path.join(__dirname, "public", "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    const base = path.basename(file.originalname || "file", ext).replace(/\s+/g, "_");
    const uniq = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `${base}-${uniq}${ext}`);
  },
});
const upload = multer({ storage });

const uploadFields = upload.fields([
  { name: "businessCertImage", maxCount: 1 }, // 사업자등록증
  { name: "menuImage[]", maxCount: 50 },      // 메뉴 이미지
  { name: "storeImages", maxCount: 10 },      // 가게 대표 이미지(있으면)
]);

// ────────────────────────────────────────────────────────────
// Health / Debug
// ────────────────────────────────────────────────────────────
app.get("/", (_req, res) => res.send("서버 실행 중입니다."));
app.get("/__debug", (_req, res) =>
  res.json({
    cwd: process.cwd(),
    __dirname,
    public: path.join(__dirname, "public"),
    public2: path.join(__dirname, "public2"),
    uploadDir,
    PORT,
  })
);

// ────────────────────────────────────────────────────────────
/**
 * 등록 API
 * - ncombinedregister.html 의 fetch('/store', { method:'POST', body: FormData })
 * - 업로드된 파일은 /public/uploads 에 저장, 응답에는 /uploads/파일명 URL 포함
 */
// ────────────────────────────────────────────────────────────
app.post("/store", uploadFields, async (req, res) => {
  try {
    const data = req.body || {};
    const mapFiles = (arr = []) =>
      arr.map((f) => ({
        field: f.fieldname,
        name: f.originalname,
        size: f.size,
        url: "/uploads/" + path.basename(f.path),
      }));

    const files = {
      businessCertImage: mapFiles(req.files?.["businessCertImage"]),
      menuImages: mapFiles(req.files?.["menuImage[]"]),
      storeImages: mapFiles(req.files?.["storeImages"]),
    };

    console.log("📩 /store 등록 요청", { fields: data, files });
    const fakeId = Date.now(); // 나중에 DB ID로 교체

    return res.status(201).json({
      ok: true,
      storeId: fakeId,
      message: "등록 완료",
      files,
    });
  } catch (err) {
    console.error("❌ /store 에러:", err);
    return res.status(500).json({ ok: false, message: "서버 오류" });
  }
});

// ────────────────────────────────────────────────────────────
// 404 핸들러
// ────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ ok: false, message: "Not Found" });
});

// ────────────────────────────────────────────────────────────
// 서버 시작
// ────────────────────────────────────────────────────────────
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 서버 실행 중! http://localhost:${PORT}`);
});
