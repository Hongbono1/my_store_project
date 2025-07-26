

console.log("=== 서버 파일 시작 ===");


import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import path from "path";
import multer from "multer";

// 라우터 import
import hotRouter from "./routes/hot.js";
import storeRouter from "./routes/store.js";
import miscRouter from "./routes/misc.js";
import categoryRouter from "./routes/category.js";
import subcategoryRouter from "./routes/subcategory.js";
import restaurantRouter from "./routes/restaurant.js";
import openRouter from "./routes/open.js";
import storeprideRouter from "./routes/storepride.js";
import marketRouter from "./routes/market.js";
import artRouter from "./routes/art.js";

// multer 업로드 폴더
const upload = multer({ dest: path.join(process.cwd(), "public", "uploads/") });

const app = express();
const PORT = process.env.PORT || 3000;

/* ── 공통 미들웨어 ─────────────────── */
app.use(cors({ origin: ["https://www.hongbono1.com", "http://localhost:3000"] }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ── 정적 파일 서빙 ─────────────────── */
app.use("/uploads", express.static(path.join(process.cwd(), "public", "uploads")));
app.use(express.static(path.join(process.cwd(), "public")));

/* HTML charset=UTF-8 강제 */
app.use((req, res, next) => {
  if (req.path.endsWith(".html")) res.setHeader("Content-Type", "text/html; charset=UTF-8");
  next();
});

/* ── 라우터 ─────────────────────────── */
app.use("/hot", hotRouter);
app.use("/restaurant", restaurantRouter);
app.use("/store", storeRouter);
app.use("/category", categoryRouter);
app.use("/subcategory", subcategoryRouter);
app.use("/open", openRouter);
app.use("/", miscRouter);
app.use("/api/storepride", storeprideRouter);
app.use("/market", marketRouter);
app.use('/art', artRouter);

// ★★★ 공연/예술/버스커 리스트 분리 API (카테고리별) 추가! ★★★
app.use("/api/events", (req, res, next) => {
  req.query.category = "공연";
  next();
}, artRouter);

app.use("/api/arts", (req, res, next) => {
  req.query.category = "예술";
  next();
}, artRouter);

app.use("/api/buskers", (req, res, next) => {
  req.query.category = "버스커";
  next();
}, artRouter);

// (예시: 임시 업로드 라우트)
app.post("/storeprideregister", upload.any(), async (req, res) => {
  try {
    res.json({ success: true, message: "등록 성공!", body: req.body, files: req.files });
  } catch (err) {
    res.status(500).json({ success: false, error: "서버 오류" });
  }
});

/* ── 헬스 체크 ──────────────────────── */
app.get("/", (_req, res) => res.send("서버 실행 중입니다."));

app.listen(PORT, () => console.log(`🚀 서버 실행 중! http://localhost:${PORT}`));

