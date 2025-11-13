import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";

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
import { makeStorePrideRouter } from "./routes/storeprideRouter.js";
import pool from "./db.js"; //


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    // ✅ POST 요청 특별 로깅
    if (req.method === 'POST') {
      console.log(`🔥 POST 요청 상세: ${req.originalUrl} | Content-Type: ${req.get('content-type') || 'none'}`);
    }
  });
  next();
});

app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

/* API 라우트 먼저 설정 */
app.use("/owner", ownerRouter);
app.use("/api/hotsubcategory", hotsubcategoryRouter);
app.use("/api/suggest", suggestRouter);
app.use("/api/storepride", makeStorePrideRouter(pool));

// ✅ 임시: 테이블 구조 확인 및 컬럼 추가 엔드포인트
app.get("/admin/check-table", async (req, res) => {
  try {
    const { default: pool } = await import("./db.js");
    
    // 현재 테이블 구조 확인
    const columns = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'open_stores' 
      ORDER BY ordinal_position;
    `);
    
    // detail_address 컬럼 존재 여부 확인
    const hasDetailAddress = columns.rows.some(col => col.column_name === 'detail_address');
    
    if (!hasDetailAddress) {
      console.log("📝 detail_address 컬럼 추가 중...");
      await pool.query(`ALTER TABLE open_stores ADD COLUMN detail_address TEXT`);
      console.log("✅ detail_address 컬럼이 추가되었습니다!");
      
      // 업데이트된 구조 재조회
      const updatedColumns = await pool.query(`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'open_stores' 
        ORDER BY ordinal_position;
      `);
      
      res.json({
        success: true,
        message: "detail_address 컬럼이 추가되었습니다",
        columns: updatedColumns.rows
      });
    } else {
      res.json({
        success: true,
        message: "detail_address 컬럼이 이미 존재합니다",
        columns: columns.rows
      });
    }
    
  } catch (error) {
    console.error("❌ 테이블 구조 확인 오류:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ✅ 새로운 명확한 API 엔드포인트
app.use("/api/open/register", openregisterRouter); // POST /api/open/register (API)
app.use("/api/open", openRouter);               // GET /api/open (목록 API)
app.use("/api/open", opendetailRouter);         // GET /api/open/:id (상세 API)
app.use("/open/register", openregisterRouter); // POST /open/register (호환성)
app.use("/open", openRouter);                   // GET /open (목록)
app.use("/open", opendetailRouter);             // GET /open/:id (상세)

// ✅ 기존 호환성 유지 (단계적 마이그레이션)
app.use("/openregister", openregisterRouter);  // 구버전 지원
app.use("/upload", uploadRouter);

/* 정적 파일 */
// ✅ HTML 파일은 캐시 방지 (항상 최신 버전 로드)
app.use(express.static(path.join(__dirname, "public2"), { 
  extensions: ["html"],
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));
app.use("/public2", express.static(path.join(__dirname, "public2"), { extensions: ["html"] }));
app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"] }));
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));




/* ✅ HTML 직접 라우트 */
app.get("/hotsubcategory", (req, res) => {
  res.sendFile(path.join(__dirname, "public2", "hotsubcategory.html"));
});
app.get("/hotblogdetail", (req, res) => {
  res.sendFile(path.join(__dirname, "public2", "hotblogdetail.html"));
});


/* 사업자 인증 프록시 */
app.post("/verify-biz", async (req, res) => {
  try {
    const body = req.body || {};
    let raw = "";
    if (Array.isArray(body.b_no)) raw = body.b_no[0];
    else if (typeof body.b_no === "string") raw = body.b_no;
    else if (body.bNo) raw = body.bNo;
    else if (body.bizNumber) raw = body.bizNumber;
    else if (body.biz1 && body.biz2 && body.biz3) raw = `${body.biz1}${body.biz2}${body.biz3}`;

    const digits = String(raw || "").replace(/[^\d]/g, "");
    const b_no = digits.slice(0, 10);

    if (b_no.length !== 10) {
      return res.status(200).json({ status_code: "ERROR", ok: false, message: "invalid b_no", data: [] });
    }

    if (!process.env.BIZ_API_KEY) {
      return res.status(200).json({
        status_code: "OK",
        data: [{ b_no, b_stt_cd: "01", b_stt: "계속사업자", b_nm: "" }],
      });
    }

    const url =
      "https://api.odcloud.kr/api/nts-businessman/v1/status?serviceKey=" +
      encodeURIComponent(process.env.BIZ_API_KEY);

    const upstream = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ b_no: [b_no] }),
    });

    if (!upstream.ok) {
      console.error("[verify-biz] upstream HTTP", upstream.status);
      return res.status(200).json({ status_code: "ERROR", ok: false, data: [] });
    }

    const payload = await upstream.json();
    return res.status(200).json(payload);
  } catch (e) {
    console.error("[verify-biz] error:", e);
    return res.status(200).json({ status_code: "ERROR", ok: false, data: [] });
  }
});

/* API 라우터 */
console.log("[boot] mounting /store -> foodregisterRouter");
app.use("/store", foodregisterRouter);

console.log("[boot] mounting /combined -> ncombinedregister");
app.use("/combined", ncombinedregister);

console.log("[boot] mounting /api/subcategory -> subcategoryRouter");
app.use("/api/subcategory", subcategoryRouter);

console.log("[boot] mounting /api/hotblog -> hotblogregister");
app.use("/api/hotblog", hotblogRouter);

/* 헬스체크 */
app.get("/__ping", (_req, res) => res.json({ ok: true }));

/* 라우트 목록 */
function collectRoutes(app) {
  const out = [];
  app._router?.stack?.forEach(layer => {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods).map(m => m.toUpperCase()).join(", ");
      out.push(`${methods} ${layer.route.path}`);
      return;
    }
    if (layer.name === "router" && layer.handle?.stack) {
      let mount = "";
      if (layer.regexp && layer.regexp.fast_star !== true) {
        const m = layer.regexp.toString().match(/\\\/([^\\^?]+)\\\//);
        if (m && m[1]) mount = `/${m[1]}`;
      }
      layer.handle.stack.forEach(r => {
        if (r.route) {
          const methods = Object.keys(r.route.methods).map(m => m.toUpperCase()).join(", ");
          out.push(`${methods} ${mount}${r.route.path}`);
        }
      });
    }
  });
  return out.sort();
}
app.get("/__routes", (_req, res) => res.json({ ok: true, routes: collectRoutes(app) }));

/* 전역 에러 핸들러 */
app.use((err, req, res, next) => {
  console.error("[error]", req?.id, err);
  if (err?.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ ok: false, error: "upload_error", code: err.code, message: err.message, reqId: req?.id });
  }
  if (err?.code?.startsWith?.("LIMIT_") || /Unexpected field/.test(err?.message || "")) {
    return res.status(400).json({ ok: false, error: "upload_error", code: err.code, message: err.message, reqId: req?.id });
  }
  res.status(500).json({ ok: false, error: "internal", message: err.message, reqId: req?.id });
});

/* 404 핸들러 */
app.use((req, res) => {
  if (/^(\/store|\/combined|\/api)\b/.test(req.path)) {
    return res.status(404).json({ ok: false, error: "not_found", path: req.path });
  }
  res.status(404).send("<h1>Not Found</h1>");
});

/* 서버 시작 */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ server on :${PORT}`));
