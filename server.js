// server.js
import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import foodregisterRouter from "./routes/foodregister.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ✅ 업로드 파일 서빙
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

/* ── ✅ 미들웨어는 라우트보다 먼저 ────────────────────────────────── */
app.use(cors());
app.use(express.json({ limit: "5mb" }));                // ← 반드시 위쪽
app.use(express.urlencoded({ extended: true }));        // ← 폼데이터 대비(선택)

/* ── ✅ 사업자 인증: 목업 + 실연동 프록시(항상 200 반환) ───────────── */
app.post("/verify-biz", async (req, res) => {
  try {
    // 다양한 형태 허용
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
      // ❗️400 대신 200 + status_code:"ERROR" (프론트 에러 throw 방지)
      return res.status(200).json({ status_code: "ERROR", ok: false, message: "invalid b_no", data: [] });
    }

    // 🔹 환경변수 키가 없으면: 목업 성공(계속사업자)
    if (!process.env.BIZ_API_KEY) {
      return res.status(200).json({
        status_code: "OK",
        data: [
          { b_no, b_stt_cd: "01", b_stt: "계속사업자", b_nm: "" } // b_nm 채우면 상호 자동입력됨
        ],
      });
    }

    // 🔹 키가 있으면: odcloud 프록시
    const url = "https://api.odcloud.kr/api/nts-businessman/v1/status?serviceKey="
      + encodeURIComponent(process.env.BIZ_API_KEY);

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

/* ── 정적 파일(라우트 뒤에 둬도 무방) ─────────────────────────────── */
app.use(express.static(path.join(__dirname, "public2"), { extensions: ["html"] }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

/* ── API: 푸드레지스터 ──────────────────────────────────────────── */
app.use("/foodregister", foodregisterRouter);

/* ── 헬스체크 ──────────────────────────────────────────────────── */
app.get("/health", (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`server on :${PORT}`));
