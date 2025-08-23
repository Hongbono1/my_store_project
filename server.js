// server.js
import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import { randomUUID } from "crypto";

// ✅ 여기로 변경: ncombinedregister 라우터 사용
import ncombinedregisterRouter from "./routes/ncombinedregister.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

/* ───────────────── 공통 미들웨어 ───────────────── */
// 요청 ID 부여 (로그 추적)
app.use((req, res, next) => {
  req.id = randomUUID();
  res.setHeader("X-Request-Id", req.id);
  next();
});

// 간단 요청 로깅
app.use((req, res, next) => {
  const started = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - started;
    console.log(
      `[${req.id}] ${req.method} ${req.originalUrl} -> ${res.statusCode} ${ms}ms`
    );
  });
  next();
});

// CORS, 바디 파서
app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

/* ───────────── 정적 파일 (HTML / 업로드) ───────────── */
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
app.use(express.static(path.join(__dirname, "public2"), { extensions: ["html"] }));
app.use(express.static(path.join(__dirname, "public")));

/* ───────────── 사업자 인증 (목업/프록시) ───────────── */
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

    // 환경변수 키 없으면 목업 성공 응답
    if (!process.env.BIZ_API_KEY) {
      return res.status(200).json({
        status_code: "OK",
        data: [{ b_no, b_stt_cd: "01", b_stt: "계속사업자", b_nm: "" }],
      });
    }

    // 실연동 프록시 (Node18 이상은 fetch 내장)
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

/* ───────────── API 라우터 (핵심) ─────────────
 * 여기서 루트("/")에 마운트하므로
 *  - 등록:  POST /store
 *  - 상세:  GET  /foodregister/:id/full
 */
app.use("/", ncombinedregisterRouter);

/* ───────────── 헬스체크 / 에러 핸들러 ───────────── */
app.get("/health", (_req, res) => res.json({ ok: true }));

app.use((err, req, res, next) => {
  console.error("[error]", req?.id, err);

  // 업로드 오류 (multer)
  if (err?.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ ok: false, error: "upload_error", code: err.code, message: err.message, reqId: req?.id });
  }
  if (err?.code?.startsWith?.("LIMIT_") || /Unexpected field/.test(err?.message || "")) {
    return res.status(400).json({ ok: false, error: "upload_error", code: err.code, message: err.message, reqId: req?.id });
  }

  // 예시 DB 오류 매핑
  if (err?.code === "ER_DUP_ENTRY") {
    return res.status(409).json({ ok: false, error: "duplicate", message: err.sqlMessage || err.message, reqId: req?.id });
  }
  if (err?.code === "ER_BAD_NULL_ERROR") {
    return res.status(400).json({ ok: false, error: "null_violation", message: err.sqlMessage || err.message, reqId: req?.id });
  }
  if (/Data too long/i.test(err?.message || "")) {
    return res.status(400).json({ ok: false, error: "too_long", message: err.message, reqId: req?.id });
  }

  res.status(500).json({ ok: false, error: "internal", message: err.message, reqId: req?.id });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ server on :${PORT}`));
