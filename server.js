import dotenv from "dotenv";
dotenv.config();

import express from "express";
import hotRouter from "./routes/hot.js";
import cors from "cors";
import path from "path";
import storeRouter from "./routes/store.js";
import miscRouter  from "./routes/misc.js";
import categoryRouter from "./routes/category.js";
import subcategoryRouter from "./routes/subcategory.js";
import restaurantRouter from "./routes/restaurant.js";

const app  = express();
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
app.use("/", miscRouter);


/* ── 헬스 체크 ──────────────────────── */
app.get("/", (_req, res) => res.send("서버 실행 중입니다."));

app.listen(PORT, () => console.log(`🚀 서버 실행 중! http://localhost:${PORT}`));