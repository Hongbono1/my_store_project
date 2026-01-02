/**  ----------------------------------------------------------
 *  MALL HANKOOK SERVER - PERSISTENT UPLOAD VERSION (A 방식)
 *  이미지 경로 /data/uploads 로 영구 저장
 *  public2/uploads와 충돌 제거
 *  기존 라우터 / 기능 절대 변경 없음 (필요 최소만 정리)
 *  ---------------------------------------------------------- */

import "dotenv/config";

import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import fetch from "node-fetch";

// Routers
import foodregisterRouter from "./routes/foodregister.js";
import ncombinedregister from "./routes/ncombinedregister.js";
import hotblogRouter from "./routes/hotblogregister.js";
import ownerRouter from "./routes/owner.js";
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
import hotplaceRouter from "./routes/hotplaceRouter.js";
import hotRouter from "./routes/hotRouter.js";
import hotblosubRouter from "./routes/hotblosubRouter.js";

import indexmanagerAdRouter from "./routes/indexmanagerAdRouter.js";
import foodcategorymanagerAdRouter from "./routes/foodcategorymanagerAdRouter.js";
import ncategory2managerAdRouter from "./routes/ncategory2managerAdRouter.js";

import subcategoryFoodAdRouter from "./routes/subcategoryFoodAdRouter.js";
import subcategoryCombinedAdRouter from "./routes/subcategoryCombinedAdRouter.js";
// import subcategorymanagerAdRouter from "./routes/subcategorymanagerAdRouter.js"; // ✅ Legacy - 주석 처리

import pool from "./db.js";

// ------------------------------------------------------------
// 0. __dirname
// ------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ------------------------------------------------------------
// 0-1. ENV 로드 확인 로그
// ------------------------------------------------------------
if (!process.env.BIZ_API_KEY) console.error("❌ BIZ_API_KEY 환경변수가 없습니다.");
else console.log("✅ BIZ_API_KEY 환경변수 감지됨");

if (!process.env.DATABASE_URL) console.error("❌ DATABASE_URL 환경변수가 없습니다.");
else console.log("✅ DATABASE_URL 환경변수 감지됨");

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
// 2. 업로드 폴더 구성 (영구 저장용)
// ------------------------------------------------------------
const isProduction = process.env.NODE_ENV === "production";
const UPLOAD_ROOT = isProduction ? "/data/uploads" : path.join(__dirname, "public2/uploads");

const uploadDirs = [
  UPLOAD_ROOT,
  path.join(UPLOAD_ROOT, "inquiry"),
  path.join(UPLOAD_ROOT, "traditionalmarket"),
  path.join(UPLOAD_ROOT, "performingart"),
  path.join(UPLOAD_ROOT, "manager_ad"),
  path.join(UPLOAD_ROOT, "ncategory2_ad"),
];

uploadDirs.forEach((dir) => {
  if (!fs.existsSync(dir)) {
    console.log("📁 폴더 생성:", dir);
    fs.mkdirSync(dir, { recursive: true });
  } else {
    console.log("📁 폴더 존재:", dir);
  }
});

// no-image.png 복사
const noImageSource = path.join(__dirname, "public2/uploads/no-image.png");
const noImageDest = path.join(UPLOAD_ROOT, "no-image.png");
if (fs.existsSync(noImageSource) && !fs.existsSync(noImageDest)) {
  try {
    fs.copyFileSync(noImageSource, noImageDest);
    console.log("✅ no-image.png copied to uploads root");
  } catch (err) {
    console.error("❌ Failed to copy no-image.png:", err);
  }
}

// ------------------------------------------------------------
// 3. Express 설정
// ------------------------------------------------------------
const app = express();

app.use((req, _res, next) => {
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

// ------------------------------------------------------------
// 3-1. 사업자번호 인증
// ------------------------------------------------------------
app.post("/verify-biz", async (req, res) => {
  try {
    const NODE_ENV = (process.env.NODE_ENV || "development").toLowerCase();
    const MODE = (process.env.BIZ_VERIFY_MODE || "real").toLowerCase();
    const isProd = NODE_ENV === "production";

    if (isProd && MODE === "mock") {
      return res.status(500).json({
        ok: false,
        message: "BIZ_VERIFY_MODE=mock is not allowed in production",
      });
    }

    const { bizNo, b_no } = req.body || {};
    let rawBizNo = bizNo;

    if (!rawBizNo) {
      if (Array.isArray(b_no) && b_no.length > 0) rawBizNo = b_no[0];
      else if (typeof b_no === "string") rawBizNo = b_no;
    }

    if (!rawBizNo) {
      return res.status(400).json({ ok: false, message: "사업자등록번호가 없습니다." });
    }

    const cleanBizNo = String(rawBizNo).replace(/-/g, "").trim();

    // MOCK
    if (!isProd && MODE === "mock") {
      const last = cleanBizNo.slice(-1);
      const isOk = last !== "0";
      return res.json({
        ok: true,
        data: [
          isOk
            ? { b_no: cleanBizNo, b_stt_cd: "01", b_stt: "계속사업자", tax_type: "mock", tax_type_cd: "00" }
            : { b_no: cleanBizNo, b_stt_cd: "02", b_stt: "휴업자/폐업자/미등록(mock)", tax_type: "mock", tax_type_cd: "00" },
        ],
        mock: true,
      });
    }

    // REAL
    const serviceKey = process.env.BIZ_API_KEY;
    if (!serviceKey) {
      console.error("❌ BIZ_API_KEY 환경변수가 없습니다.");
      return res.status(500).json({ ok: false, message: "서버 설정 오류(BIZ_API_KEY 미설정)" });
    }

    const API_URL = `https://api.odcloud.kr/api/nts-businessman/v1/status?serviceKey=${encodeURIComponent(serviceKey)}`;

    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ b_no: [cleanBizNo] }),
    });

    const data = await response.json();

    if (!data?.data || data.data.length === 0) {
      console.error("verify-biz 응답 이상:", data);
      return res.status(500).json({ ok: false, message: "국세청 응답 없음", raw: data });
    }

    return res.json({ ok: true, data: data.data });
  } catch (err) {
    console.error("verify-biz ERROR:", err.message);
    return res.status(500).json({ ok: false, message: "서버 오류" });
  }
});

// ------------------------------------------------------------
// ✅ 핵심: /api/subcategory 라우터는 “서브카테고리 페이지에서 가게 목록”용
// - 매니저(grid/slot)는 /subcategorymanager_* 쪽과 완전 별개
// ------------------------------------------------------------
const subcategoryRouter = express.Router();

/**
 * GET /api/subcategory/combined?category=반려동물
 * - combined_store_info 기반
 */
subcategoryRouter.get("/combined", async (req, res) => {
  try {
    const category = String(req.query.category || "").trim();
    if (!category) return res.json({ success: true, stores: [] });

    const sql = `
      SELECT
        id,
        business_number,
        business_name,
        business_type,
        btrim(replace(business_category::text, chr(160), ' ')) AS business_category,
        btrim(replace(business_subcategory::text, chr(160), ' ')) AS business_subcategory,
        business_hours,
        delivery_option,
        service_details,
        event1,
        event2,
        facilities,
        pets_allowed,
        parking,
        phone,
        homepage,
        instagram,
        facebook,
        additional_desc,
        postal_code,
        road_address,
        detail_address,
        owner_name,
        birth_date,
        owner_email,
        owner_address,
        owner_phone,
        business_cert_path,
        created_at,
        main_image_url,
        view_count
      FROM public.combined_store_info
      WHERE btrim(replace(business_category::text, chr(160), ' ')) = btrim(replace($1::text, chr(160), ' '))
      ORDER BY id DESC
    `;

    const { rows } = await pool.query(sql, [category]);
    return res.json({ success: true, stores: rows });
  } catch (err) {
    console.error("❌ /api/subcategory/combined error:", err?.message || err);
    return res.status(500).json({ success: false, error: "server_error" });
  }
});

/**
 * GET /api/subcategory/food?category=한식&subcategory=국밥
 * - store_info 기반
 */
subcategoryRouter.get("/food", async (req, res) => {
  try {
    const category = String(req.query.category || "").trim();
    const subcategory = String(req.query.subcategory || "").trim();

    if (!category) return res.json({ success: true, stores: [] });

    const sql = `
      SELECT
        id,
        business_number,
        business_name,
        business_type,
        btrim(replace(business_category::text, chr(160), ' ')) AS business_category,
        btrim(replace(detail_category::text, chr(160), ' ')) AS business_subcategory,
        created_at
      FROM public.store_info
      WHERE btrim(replace(business_category::text, chr(160), ' ')) = btrim(replace($1::text, chr(160), ' '))
        AND (
          $2 = '' OR btrim(replace(detail_category::text, chr(160), ' ')) = btrim(replace($2::text, chr(160), ' '))
        )
      ORDER BY id DESC
    `;

    const { rows } = await pool.query(sql, [category, subcategory]);
    return res.json({ success: true, stores: rows });
  } catch (err) {
    console.error("❌ /api/subcategory/food error:", err?.message || err);
    return res.status(500).json({ success: false, error: "server_error" });
  }
});

// ✅ 여기 “반드시” 있어야 /api/subcategory/* 가 404가 안 남
app.use("/api/subcategory", subcategoryRouter);

// ------------------------------------------------------------// 3-1. 카테고리 트리 API (사이드바용)
// ------------------------------------------------------------
app.get("/api/category-tree", async (req, res) => {
    try {
        const mode = String(req.query.mode || "combined").trim();
        
        // combined_store_info에서 카테고리 목록 가져오기
        const sql = `
            SELECT DISTINCT 
                business_category AS category,
                detail_category AS subcategory
            FROM combined_store_info
            WHERE business_category IS NOT NULL 
                AND business_category != ''
            ORDER BY business_category, detail_category
        `;
        
        const { rows } = await pool.query(sql);
        
        // 카테고리별로 그룹화
        const map = new Map();
        for (const row of rows) {
            const cat = (row.category || "").trim();
            if (!cat) continue;
            
            if (!map.has(cat)) {
                map.set(cat, new Set());
            }
            
            const sub = (row.subcategory || "").trim();
            if (sub) {
                map.get(cat).add(sub);
            }
        }
        
        // 배열로 변환
        const categories = [...map.entries()].map(([category, subSet]) => ({
            category,
            subcategories: [...subSet].sort((a, b) => a.localeCompare(b, "ko"))
        })).sort((a, b) => a.category.localeCompare(b.category, "ko"));
        
        res.json({ success: true, categories });
    } catch (err) {
        console.error("❌ /api/category-tree error:", err?.message || err);
        res.status(500).json({ success: false, error: err?.message || "server error" });
    }
});

// ------------------------------------------------------------// 4. 문의 게시판 라우트
// ------------------------------------------------------------
app.use("/api/inquiryBoard", inquiryBoardRouter);
app.use("/api/inquiry", inquiryBoardRouter);

// ------------------------------------------------------------
// 5. 주요 API 라우트
// ------------------------------------------------------------
app.use("/owner", ownerRouter);
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

// 기존 매니저
// app.use("/subcategorymanager/ad", subcategorymanagerAdRouter); // ✅ Legacy - 주석 처리

// hot
app.use("/api/hotblog", hotblogRouter);
app.use("/api/hotplace", hotplaceRouter);
app.use("/api/hot", hotRouter);
app.use("/api/hotsubcategory", hotblosubRouter);

// 관리자
app.use("/manager/ad", indexmanagerAdRouter);
app.use("/foodcategorymanager/ad", foodcategorymanagerAdRouter);
app.use("/ncategory2manager/ad", ncategory2managerAdRouter);

// ✅ 서브카테고리 매니저 (FOOD/COMBINED 분리) — 이게 네 grid 엔드포인트
app.use("/subcategorymanager_food/ad", subcategoryFoodAdRouter);
app.use("/subcategorymanager_combined/ad", subcategoryCombinedAdRouter);

// ------------------------------------------------------------
// 6. 정적 파일 (public2)
// ------------------------------------------------------------
app.use(
  express.static(path.join(__dirname, "public2"), {
    extensions: ["html"],
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".html")) {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
      }
    },
  })
);

// ------------------------------------------------------------
// 7. 업로드 파일 정적 서빙
// ------------------------------------------------------------
app.use("/uploads", express.static(UPLOAD_ROOT));
app.use("/uploads", express.static(path.join(__dirname, "public2/uploads")));

// ------------------------------------------------------------
// 8. 헬스체크
// ------------------------------------------------------------
app.get("/__ping", (_req, res) => res.json({ ok: true }));

// ------------------------------------------------------------
// 9. 에러 핸들러
// ------------------------------------------------------------
app.use((err, req, res, _next) => {
  console.error("[error]", req.id, err);

  if (err.code === "LIMIT_FILE_SIZE") return res.status(413).json({ ok: false, error: "file_too_large" });
  if (/Unexpected field/.test(err.message)) return res.status(400).json({ ok: false, error: "upload_field_error" });

  res.status(500).json({ ok: false, error: "internal", message: err.message });
});

// ------------------------------------------------------------
// 10. 404 핸들러
// ------------------------------------------------------------
app.use((req, res) => {
  if (/^(\/store|\/combined|\/api)/.test(req.path)) return res.status(404).json({ ok: false, error: "not_found" });
  res.status(404).send("<h1>Not Found</h1>");
});

// ------------------------------------------------------------
// 11. 서버 실행
// ------------------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 MALL HANKOOK server running on http://127.0.0.1:${PORT}`);
  console.log(`📁 Static root: public2/`);
  console.log(`📤 Upload folder (persistent): ${UPLOAD_ROOT}`);
});
