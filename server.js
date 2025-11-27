import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import fs from "fs";
import pool from "./db.js";

// Router imports
import foodregisterRouter from "./routes/foodregister.js";
import ncombinedregisterRouter from "./routes/ncombinedregister.js";
import subcategoryRouter from "./routes/subcategory.js";
import hotblogRouter from "./routes/hotblogregister.js";
import ownerRouter from "./routes/owner.js";
import hotsubcategoryRouter from "./routes/hotsubcategoryRouter.js";
import suggestRouter from "./routes/suggestRouter.js";
import openregisterRouter from "./routes/openregisterRouter.js";
import openRouter from "./routes/openRouter.js";
import opendetailRouter from "./routes/opendetailRouter.js";
import uploadRouter from "./routes/upload.js";
import { makeStorePrideRegisterRouter } from "./routes/storePrideRegisterRouter.js";
import storeprideRouter from "./routes/storeprideRouter.js";
import traditionalmarketregisterRouter from "./routes/traditionalmarketregisterRouter.js";
import traditionalmarketdetailRouter from "./routes/traditionalmarketdetailRouter.js";
import bestpickRouter from "./routes/bestpickRouter.js";
import performingartRouter from "./routes/performingartRouter.js";
import performingartregisterRouter from "./routes/performingartregisterRouter.js";
import performingartdetailRouter from "./routes/performingartdetailRouter.js";
import eventregisterRouter from "./routes/eventregisterRouter.js";
import localboardRouter from "./routes/localboardRouter.js";
import onewordRouter from "./routes/onewordRouter.js";
import shoppingRegisterRouter from "./routes/shoppingRegisterRouter.js";
import shoppingDetailRouter from "./routes/shoppingDetailRouter.js";
import inquiryBoardRouter from "./routes/inquiryBoardRouter.js";  // ✅ 새 문의 게시판
import localRankRouter from "./routes/localRankRouter.js";
import storeRouter from "./routes/storeRouter.js";

// 공연/예술 테이블 자동 생성
async function initPerformingArtsTables() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS performing_arts (
        id SERIAL PRIMARY KEY,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE,
        time VARCHAR(100),
        venue VARCHAR(255),
        address TEXT,
        description TEXT NOT NULL,
        price VARCHAR(100),
        host VARCHAR(255),
        age_limit VARCHAR(50),
        capacity INTEGER,
        tags TEXT,
        social1 TEXT,
        social2 TEXT,
        social3 TEXT,
        booking_url TEXT,
        phone VARCHAR(50),
        main_img TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS performing_arts_files (
        id SERIAL PRIMARY KEY,
        art_id INTEGER REFERENCES performing_arts(id) ON DELETE CASCADE,
        file_type VARCHAR(20) NOT NULL,
        file_path TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("✅ performing_arts 테이블 준비 완료");
  } catch (err) {
    console.error("❌ performing_arts 테이블 생성 오류:", err.message);
  }
}

initPerformingArtsTables();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 📁 업로드 폴더 자동 생성
const uploadDirs = [
  path.join(__dirname, "public/uploads"),
  path.join(__dirname, "public/uploads/traditionalmarket"),
  path.join(__dirname, "public/uploads/performingart"),
  path.join(__dirname, "public/uploads/inquiry"),  // ✅ 문의 업로드 폴더
  path.join(__dirname, "public2/uploads"),
  path.join(__dirname, "public2/uploads/inquiry")
];

uploadDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    console.log("📁 폴더 생성:", dir);
    fs.mkdirSync(dir, { recursive: true });
  } else {
    console.log("✅ 폴더 존재:", dir);
  }
});

// ✅ Express app 인스턴스 생성
const app = express();

/* 공통 미들웨어 */
app.use((req, res, next) => {
  req.id = randomUUID();
  res.setHeader("X-Request-Id", req.id);
  next();
});

app.use((req, res, next) => {
  const started = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - started;
    console.log(`[${req.id}] ${req.method} ${req.originalUrl} -> ${res.statusCode} ${ms}ms`);
    if (req.method === 'POST') {
      console.log(`🔥 POST 요청: ${req.originalUrl} | Content-Type: ${req.get('content-type') || 'none'}`);
    }
  });
  next();
});

app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

/* ✅ 문의 게시판 API 라우트 */
console.log("[boot] mounting /api/inquiryBoard -> inquiryBoardRouter");
app.use("/api/inquiryBoard", inquiryBoardRouter);

// 🔁 기존 /api/inquiry도 같은 라우터로 연결 (하위 호환성)
console.log("[boot] mounting /api/inquiry -> inquiryBoardRouter (legacy)");
app.use("/api/inquiry", inquiryBoardRouter);

/* 기타 API 라우트 설정 */
app.use("/owner", ownerRouter);
app.use("/api/hotsubcategory", hotsubcategoryRouter);
app.use("/api/suggest", suggestRouter);

// ✅ 홍보의 신문 API 추가
app.use("/api", storeRouter);

app.use("/api/storeprideregister", makeStorePrideRegisterRouter(pool));
app.use("/storepride", storeprideRouter);
app.use("/api/market", traditionalmarketregisterRouter);
app.use("/api/market", traditionalmarketdetailRouter);
app.use("/api/performingart", performingartRouter);
app.use("/api/performingart", performingartregisterRouter);
app.use("/api/performingart", performingartdetailRouter);
app.use("/api/events", eventregisterRouter);
app.use("/api/localboard", localboardRouter);
app.use("/api/oneword", onewordRouter);
app.use("/shopping/register", shoppingRegisterRouter);
app.use("/api/shopping", shoppingDetailRouter);
app.use("/api/best-pick", bestpickRouter);

app.use("/api/open/register", openregisterRouter);
app.use("/api/open", openRouter);
app.use("/api/open", opendetailRouter);
app.use("/open/register", openregisterRouter);
app.use("/open", openRouter);
app.use("/open", opendetailRouter);
app.use("/openregister", openregisterRouter);
app.use("/upload", uploadRouter);

/* 정적 파일 서빙 - 강력한 캐시 방지 */
app.use(express.static(path.join(__dirname, "public2"), {
  extensions: ["html"],
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, private');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Last-Modified', new Date().toUTCString());
      res.setHeader('ETag', Date.now().toString());
    }
  }
}));

app.use("/public2", express.static(path.join(__dirname, "public2"), { extensions: ["html"] }));
app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"] }));

// ✅ 업로드 파일 서빙
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));
app.use("/uploads", express.static(path.join(__dirname, "public2/uploads")));

/* 나머지 라우터들 */
console.log("[boot] mounting /store -> foodregisterRouter");
app.use("/store", foodregisterRouter);      // /store/:id/full 처리

console.log("[boot] mounting /combined -> ncombinedregister");
app.use("/combined", ncombinedregisterRouter); // /combined/:id/full 처리

console.log("[boot] mounting /api/subcategory -> subcategoryRouter");
app.use("/api/subcategory", subcategoryRouter);

console.log("[boot] mounting /api/hotblog -> hotblogregister");
app.use("/api/hotblog", hotblogRouter);

/* 헬스체크 */
app.get("/__ping", (_req, res) => res.json({ ok: true }));

/* 전역 에러 핸들러 */
app.use((err, req, res, next) => {
  console.error("[error]", req?.id, err);
  if (err?.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ 
      ok: false, 
      error: "upload_error", 
      code: err.code, 
      message: err.message, 
      reqId: req?.id 
    });
  }
  if (err?.code?.startsWith?.("LIMIT_") || /Unexpected field/.test(err?.message || "")) {
    return res.status(400).json({ 
      ok: false, 
      error: "upload_error", 
      code: err.code, 
      message: err.message, 
      reqId: req?.id 
    });
  }
  res.status(500).json({ 
    ok: false, 
    error: "internal", 
    message: err.message, 
    reqId: req?.id 
  });
});

/* 404 핸들러 */
app.use((req, res) => {
  if (/^(\/store|\/combined|\/api)\b/.test(req.path)) {
    return res.status(404).json({ ok: false, error: "not_found", path: req.path });
  }
  res.status(404).send("<h1>Not Found</h1>");
});

// ✅ 서버 리슨
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`\n🚀 MALL HANKOOK server running on http://127.0.0.1:${PORT}`);
  console.log(`📡 Inquiry API: /api/inquiryBoard (new) & /api/inquiry (legacy)`);
  console.log(`📁 Static files: public2/`);
  console.log(`📤 Upload directory: public/uploads/inquiry/\n`);
});