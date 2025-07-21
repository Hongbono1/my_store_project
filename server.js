import dotenv from "dotenv";
dotenv.config();

import express from "express";
import hotRouter from "./routes/hot.js";
import cors from "cors";
import path from "path";
import storeRouter from "./routes/store.js";
import miscRouter from "./routes/misc.js";
import categoryRouter from "./routes/category.js";
import subcategoryRouter from "./routes/subcategory.js";
import restaurantRouter from "./routes/restaurant.js";
import openRouter from "./routes/open.js";
import storeprideRouter from "./routes/storepride.js";

import multer from "multer";
const upload = multer({ dest: path.join(process.cwd(), "public", "uploads/") }); // public/uploads로 저장

const app = express();
const PORT = process.env.PORT || 3000;

/* ── 공통 미들웨어 ─────────────────── */
app.use(cors({ origin: ["https://www.hongbono1.com", "http://localhost:3000"] }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ── 정적 파일 ─────────────────────── */
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

/* ── 우리 가게 자랑 등록(multer로 파일+폼데이터) ───────────────── */
app.post("/storeprideregister", upload.any(), async (req, res) => {
  try {
    // req.body: 폼 입력 데이터
    // req.files: 업로드된 파일(이미지 등) 배열
    // 실제 DB 저장 처리 등을 여기에 추가
    res.json({ success: true, message: "등록 성공!", body: req.body, files: req.files });
  } catch (err) {
    console.error("자랑 등록 오류:", err);
    res.status(500).json({ success: false, error: "서버 오류" });
  }
});

/* ── 헬스 체크 ──────────────────────── */
app.get("/", (_req, res) => res.send("서버 실행 중입니다."));

app.listen(PORT, () => console.log(`🚀 서버 실행 중! http://localhost:${PORT}`));
