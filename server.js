import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

// __dirname (ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// 공통 미들웨어
app.use(cors({ origin: ["https://www.hongbono1.com", "http://localhost:3000"] }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 정적(라우터보다 먼저, __dirname 기준)
app.use("/uploads", express.static(path.join(__dirname, "public", "uploads")));
app.use(express.static(path.join(__dirname, "public")));
app.use("/new", express.static(path.join(__dirname, "public2")));

// 헬스/디버그
app.get("/", (_req, res) => res.send("서버 실행 중입니다."));
app.get("/__debug", (_req, res) => res.json({
  cwd: process.cwd(),
  __dirname,
  public: path.join(__dirname, "public"),
  public2: path.join(__dirname, "public2"),
  PORT
}));

// 서버 실행 (0.0.0.0로 명시)
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 서버 실행 중! http://localhost:${PORT}`);
});
