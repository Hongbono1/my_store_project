import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";

import ncombinedregister from "./routes/ncombinedregister.js";
import subcategoryRouter from "./routes/subcategory.js";   // ★ 추가

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
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));


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

/* ───────────────── API 라우터 (루트 마운트) ───────────────── */
app.use("/", ncombinedregister);
app.use("/api/subcategory", subcategoryRouter);   // ★ 추가됨

/* ───────────────── 헬스체크 ───────────────── */
app.get("/health", (_req, res) => res.json({ ok: true }));

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

/* ───────────────── 서버 시작 ───────────────── */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ server on :${PORT}`));
