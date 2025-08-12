// server.js
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import path from "path";
import storeRouter from "./routes/store.js";

const app = express();
const PORT = process.env.PORT || 3000;

// ── CORS / 바디 파서
app.use(cors({
  origin: ["https://www.hongbono1.com", "http://localhost:3000"]
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── 정적 파일: public 제거, public2만 루트에 연결
// !! 아래 한 줄만으로 /foodregister.html, /assets/... 전부 루트에서 접근 가능
app.use(express.static(path.join(process.cwd(), "public2")));

// (선택) 업로드 파일도 public2/uploads에 저장/서빙한다면:
app.use("/uploads", express.static(path.join(process.cwd(), "public2", "uploads")));

// ── API 라우터
app.use("/store", storeRouter);

// ── 서버 시작
app.listen(PORT, () => {
  console.log(`✅ Server running on ${PORT}`);
});
