import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import path from "path";
import storeRouter from "./routes/store.js";   // ← 새로 만든 라우터만 import

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

// ── 정적 파일 서빙
app.use("/uploads", express.static(path.join(process.cwd(), "public", "uploads")));
app.use(express.static(path.join(process.cwd(), "public")));
app.use("/new", express.static(path.join(process.cwd(), "public2"))); // public2도 필요하면

// ── 라우터 연결 (이것만 남겨둬도 됨!)
app.use("/store", storeRouter);

// ── 헬스체크/기본
app.get("/", (_req, res) => res.send("서버 실행 중입니다."));

// ── 서버 실행
app.listen(PORT, () => console.log(`🚀 서버 실행 중! http://localhost:${PORT}`));
