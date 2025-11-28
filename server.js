/**  ----------------------------------------------------------
 *  MALL HANKOOK SERVER - PERSISTENT UPLOAD VERSION (A 방식)
 *  이미지 경로 /data/uploads 로 영구 저장
 *  public2/uploads와 충돌 제거
 *  기존 라우터 / 기능 절대 변경 없음
 *  ---------------------------------------------------------- */

import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";

// Routers
import foodregisterRouter from "./routes/foodregister.js";
import ncombinedregister from "./routes/ncombinedregister.js";
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
import inquiryBoardRouter from "./routes/inquiryBoardRouter.js";
import localRankRouter from "./routes/localRankRouter.js";

import pool from "./db.js";

// ------------------------------------------------------------
// 0. __dirname 설정
// ------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ------------------------------------------------------------
// 1. 공연/예술 테이블 자동 생성
// ------------------------------------------------------------
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

// ------------------------------------------------------------
// 2. 업로드 폴더 구성 (영구 저장용 /data/uploads)
// ------------------------------------------------------------
const UPLOAD_ROOT = "/data/uploads"; // ★★★ 영구 저장 A 방식 ★★★

const uploadDirs = [
  UPLOAD_ROOT,
  path.join(UPLOAD_ROOT, "inquiry"),
  path.join(UPLOAD_ROOT, "traditionalmarket"),
  path.join(UPLOAD_ROOT, "performingart")
];

uploadDirs.forEach((dir) => {
  if (!fs.existsSync(dir)) {
    console.log("📁 폴더 생성:", dir);
    fs.mkdirSync(dir, { recursive: true });
  } else {
    console.log("📁 폴더 존재:", dir);
  }
});

// ------------------------------------------------------------
// 3. Express 설정
// ------------------------------------------------------------
const app = express();

app.use((req, res, next) => {
  req.id = randomUUID();
  next();
});

app.use((req, res, next) => {
  const started = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - started;
    console.log(`[${req.id}] ${req.method} ${req.originalUrl} -> ${res.statusCode} ${ms}ms`);
  });
  next();
});

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// -------------------------------
// 표준화된 국세청 사업자번호 인증 API
// -------------------------------
import fetch from "node-fetch";

app.post("/verify-biz", async (req, res) => {
  try {
    const { bizNo } = req.body;

    if (!bizNo) {
      return res.status(400).json({
        ok: false,
        message: "사업자등록번호가 없습니다."
      });
    }

    // 환경변수 확인
    if (!process.env.BIZ_API_KEY) {
      console.error("❌ BIZ_API_KEY 환경변수가 없습니다.");
      return res.status(500).json({ ok: false, message: "환경변수 없음" });
    }

    const API_URL = `https://api.odcloud.kr/api/nts-businessman/v1/status?serviceKey=${process.env.BIZ_API_KEY}`;

    const cleanBizNo = bizNo.replace(/-/g, "");

    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        b_no: [cleanBizNo]
      })
    });

    const data = await response.json();

    if (!data || !data.data || data.data.length === 0) {
      return res.status(500).json({
        ok: false,
        message: "국세청 응답 없음"
      });
    }

    return res.json({
      ok: true,
      data: data.data[0]
    });

  } catch (err) {
    console.error("verify-biz ERROR:", err.message);
    return res.status(500).json({ ok: false, message: "서버 오류" });
  }
});

// ------------------------------------------------------------
// 4. 문의 게시판 라우트
// ------------------------------------------------------------
app.use("/api/inquiryBoard", inquiryBoardRouter);
app.use("/api/inquiry", inquiryBoardRouter);

// ------------------------------------------------------------
// 5. 주요 API 라우트
// ------------------------------------------------------------
app.use("/owner", ownerRouter);
app.use("/api/hotsubcategory", hotsubcategoryRouter);
app.use("/api/suggest", suggestRouter);
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
app.use("/open", openRouter);
app.use("/open/register", openregisterRouter);
app.use("/open", opendetailRouter);
app.use("/upload", uploadRouter);

app.use("/store", foodregisterRouter);
app.use("/combined", ncombinedregister);
app.use("/api/subcategory", subcategoryRouter);
app.use("/api/hotblog", hotblogRouter);

// ------------------------------------------------------------
// 6. 정적 파일 (public2)
// ------------------------------------------------------------
app.use(
  express.static(path.join(__dirname, "public2"), {
    extensions: ["html"],
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".html")) {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
      }
    }
  })
);

// ------------------------------------------------------------
// 7. 업로드 파일 정적 서빙 (영구 저장 /data/uploads)
// ------------------------------------------------------------
app.use("/uploads", express.static(UPLOAD_ROOT));

// ------------------------------------------------------------
// 8. 헬스체크
// ------------------------------------------------------------
app.get("/__ping", (req, res) => res.json({ ok: true }));


// ------------------------------------------------------------
// 9. 에러 핸들러
// ------------------------------------------------------------
app.use((err, req, res, next) => {
  console.error("[error]", req.id, err);

  if (err.code === "LIMIT_FILE_SIZE")
    return res.status(413).json({ ok: false, error: "file_too_large" });

  if (/Unexpected field/.test(err.message))
    return res.status(400).json({ ok: false, error: "upload_field_error" });

  res.status(500).json({ ok: false, error: "internal", message: err.message });
});

// ------------------------------------------------------------
// 10. 404 핸들러
// ------------------------------------------------------------
app.use((req, res) => {
  if (/^(\/store|\/combined|\/api)/.test(req.path))
    return res.status(404).json({ ok: false, error: "not_found" });

  res.status(404).send("<h1>Not Found</h1>");
});

// ------------------------------------------------------------
// 11. 서버 실행
// ------------------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 MALL HANKOOK server running on http://127.0.0.1:${PORT}`);
  console.log(`📁 Static root: public2/`);
  console.log(`📤 Upload folder (persistent): /data/uploads/`);
});
