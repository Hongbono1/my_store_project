import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import ndetailRouter from "./routes/ndetail.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// 공통 미들웨어
app.use(cors({ origin: ["https://www.hongbono1.com", "http://localhost:3000"] }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 정적 경로
// ✅ 업로드는 기존 경로 유지 (public/uploads)
app.use("/uploads", express.static(path.join(__dirname, "public2", "uploads")));
// ✅ 이제 루트 정적 서빙은 public2만 사용
app.use(express.static(path.join(__dirname, "public2")));

// 필요 폴더 생성
fs.mkdirSync(path.join(__dirname, "public2", "uploads"), { recursive: true });
fs.mkdirSync(path.join(__dirname, "data", "stores"), { recursive: true });

// 라우터 (API)
app.use("/store", ndetailRouter);

// 헬스/디버그
app.get("/", (_req, res) => res.send("서버 실행 중입니다."));
app.get("/__debug", (_req, res) => {
  res.json({
    cwd: process.cwd(),
    __dirname,
    public: path.join(__dirname, "public"),
    public2: path.join(__dirname, "public2"),
    uploads: path.join(__dirname, "public", "uploads"),
    data: path.join(__dirname, "data", "stores"),
    PORT,
  });
});

// ====================== 예쁜 URL 매핑 (public2만) ======================
// /푸드  → public2/foodregister.html
// /ndetail → public2/ndetail.html
// /ncombinedregister → public2/ncombinedregister.html
const prettyMap = {
  "푸드": "foodregister.html",
  "ndetail": "ndetail.html",
  "ncombinedregister": "ncombinedregister.html",
};

app.get("/:slug", (req, res, next) => {
  const slug = decodeURIComponent(req.params.slug);
  const mapped = prettyMap[slug];
  if (!mapped) return next();

  const filePath = path.join(__dirname, "public2", mapped);
  if (fs.existsSync(filePath)) return res.sendFile(filePath);
  return next();
});

// 확장자 생략 지원: /foo → public2/foo.html (있으면 서빙)
app.use((req, res, next) => {
  if (path.extname(req.path)) return next(); // 이미 확장자 있으면 패스
  const name = decodeURIComponent(req.path).replace(/^\/+/, "");
  if (!name) return next();
  const candidate = path.join(__dirname, "public2", `${name}.html`);
  if (fs.existsSync(candidate)) return res.sendFile(candidate);
  next();
});
// =====================================================================

// 404 핸들러
app.use((_req, res) => res.status(404).json({ ok: false, message: "Not Found" }));

// 서버 시작
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 서버 실행 중! http://localhost:${PORT}`);
});
