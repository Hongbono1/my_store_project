// server.js  (메인 엔트리)
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
// 필요하면: import cors from "cors";
import foodregisterRouter from "./routes/foodregister.js"; // ← 방금 만든 전용 라우터

const app = express();
const PORT = process.env.PORT || 3000;

// 옵션: 프록시 헤더 신뢰 (리버스프록시 뒤에 있다면)
app.set("trust proxy", 1);

// 기본 미들웨어
// app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 정적 파일 (public 전체)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(process.cwd(), "public")));

// 업로드 파일 직접 접근 허용 (/uploads/xxx)
app.use("/uploads", express.static(path.join(process.cwd(), "public", "uploads")));

// ✅ foodregister.html 전용 백엔드: 엔드포인트는 /store 그대로 유지
//   프론트 fetch('/store', ...) 수정 불필요
app.use("/store", foodregisterRouter);

// 헬스체크(선택)
app.get("/healthz", (_req, res) => res.json({ ok: true }));

// 404 핸들러(선택)
app.use((req, res) => res.status(404).json({ error: "not found" }));

// 에러 핸들러(선택)
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "server error" });
});

app.listen(PORT, () => {
  console.log(`✅ Server listening on ${PORT}`);
});
