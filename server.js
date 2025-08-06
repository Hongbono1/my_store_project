import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import storeRouter from "./routes/store.js";

// __dirname (ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// ── 공통 미들웨어
app.use(cors({
    origin: [
        "https://www.hongbono1.com",
        "http://localhost:3000"
    ]
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── 정적 파일 서빙 (라우터보다 먼저, __dirname 절대경로)
app.use("/uploads", express.static(path.join(__dirname, "public", "uploads")));
app.use(express.static(path.join(__dirname, "public")));
app.use("/new", express.static(path.join(__dirname, "public2"))); // /new/xxx → public2/xxx

// ── 라우터 연결
app.use("/store", storeRouter);

// ── 헬스체크/디버그
app.get("/", (_req, res) => res.send("서버 실행 중입니다."));
app.get("/__debug", (_req, res) => {
    res.json({ cwd: process.cwd(), __dirname });
});

// ── 서버 실행
app.listen(PORT, () => {
    console.log(`🚀 서버 실행 중! http://localhost:${PORT}`);
});
