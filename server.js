// server.js
import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";

import foodregisterRouter from "./routes/foodregister.js";     // 음식점 전용 (/store)
import ncombinedregister from "./routes/ncombinedregister.js"; // 통합 전용 (/combined)
import subcategoryRouter from "./routes/subcategory.js";       // 서브카테고리 전용 (/api/subcategory)

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

/* ───────────────── 공통 미들웨어 ───────────────── */
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
  });
  next();
});

app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

/* ───────────────── 정적 파일 ───────────────── */
app.use(express.static(path.join(__dirname, "public2"), { extensions: ["html"] }));
app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"] }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
/* ──────────────── 사업자 인증 프록시 (항상 200 반환) ─────────────── */
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

/* ───────────────── API 라우터 (prefix로 분리) ───────────────── */
// 음식점 등록/조회 API → /store/...
console.log("[boot] mounting /store -> foodregisterRouter");
app.use("/store", foodregisterRouter);

// 통합 등록/조회 API → /combined/...
console.log("[boot] mounting /combined -> ncombinedregister");
app.use("/combined", ncombinedregister);

// 서브카테고리 API → /api/subcategory/...
console.log("[boot] mounting /api/subcategory -> subcategoryRouter");
app.use("/api/subcategory", subcategoryRouter);

/* ───────────────── 헬스체크 ───────────────── */
app.get("/__ping", (_req, res) => res.json({ ok: true }));

/* ───────────────── 라우트 목록(동적 수집) ───────────────── */
function collectRoutes(app) {
  const out = [];

  app._router?.stack?.forEach(layer => {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods).map(m => m.toUpperCase()).join(", ");
      out.push(`${methods} ${layer.route.path}`);
      return;
    }
    if (layer.name === "router" && layer.handle?.stack) {
      // mount path 추출
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

app.get("/__routes", (_req, res) => {
  res.json({ ok: true, routes: collectRoutes(app) });
});

/* ─────────────── 전역 에러 핸들러 ─────────────── */
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

/* ─────────────── 404 핸들러 (API는 JSON) ─────────────── */
app.use((req, res) => {
  // 🔧 /foodregister → /combined 로 반영
  if (/^(\/store|\/combined|\/api)\b/.test(req.path)) {
    return res.status(404).json({ ok: false, error: "not_found", path: req.path });
  }
  // 그 외는 정적 404 (기본 HTML)
  res.status(404).send("<h1>Not Found</h1>");
});

/* ───────────────── 서버 시작 ───────────────── */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ server on :${PORT}`));
