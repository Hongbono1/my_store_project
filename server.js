// server.js
import "dotenv/config";                  // .env 로드
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";

import foodregisterRouter from "./routes/foodregister.js"; // 라우터

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ───── 부팅 로그 (진단용)
console.log("[BOOT] PORT=", process.env.PORT || 3000);
console.log("[BOOT] DATABASE_URL len =", (process.env.DATABASE_URL || "").length);
console.log("[BOOT] ODCLOUD_SERVICE_KEY len =", (process.env.ODCLOUD_SERVICE_KEY || process.env.BIZ_API_KEY || "").length);

// ───── CORS (필요 시)
const origins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);
if (origins.length) {
  app.use(cors({ origin: origins, credentials: true }));
}

// ───── JSON/URLENCODED 파서
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ───── 정적 파일: public2가 문서 루트
const PUBLIC2 = path.join(process.cwd(), "public2");
app.use(express.static(PUBLIC2, { index: false, extensions: ["html", "htm"] }));

// ───── 업로드 정적 서빙: ✅ 루트 uploads 디렉토리에서 서빙
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ───── 요청 로깅(진단)
app.use((req, _res, next) => {
  console.log(`[REQ] ${req.method} ${req.url}`);
  next();
});

/** ---------------- /verify-biz (ODCloud 프록시) ---------------- */
app.post("/verify-biz", async (req, res) => {
  try {
    const key = process.env.ODCLOUD_SERVICE_KEY || process.env.BIZ_API_KEY;
    if (!key) return res.status(500).json({ error: "ODCLOUD_SERVICE_KEY is not set" });

    const body = req.body?.b_no ? { b_no: req.body.b_no } : req.body;
    if (!body || !Array.isArray(body.b_no) || body.b_no.length === 0) {
      return res.status(400).json({ error: 'invalid body; expected { b_no: ["##########"] }' });
    }

    const keyParam = /%[0-9A-Fa-f]{2}/.test(key) ? key : encodeURIComponent(key);
    const url = `https://api.odcloud.kr/api/nts-businessman/v1/status?serviceKey=${keyParam}`;

    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json;charset=UTF-8" },
      body: JSON.stringify(body),
    });

    const text = await r.text();
    if (!r.ok) {
      res.status(r.status);
      try { return res.json(JSON.parse(text)); }
      catch { return res.type("text/plain").send(text); }
    }
    return res.json(JSON.parse(text));
  } catch (err) {
    console.error("[/verify-biz] error:", err);
    return res.status(500).json({ error: "verify-biz failed" });
  }
});

/** ---------------- 라우터 연결 ---------------- */
app.use("/foodregister", foodregisterRouter);

/** 헬스체크 */
app.get("/health", (_req, res) => res.json({ ok: true }));

/** 404 핸들러 */
app.use((req, res) => res.status(404).json({ error: "not found" }));

/** 에러 핸들러 (안전망) */
app.use((err, _req, res, _next) => {
  console.error("[EXPRESS ERROR]", err);
  res.status(500).json({ error: "server error" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[LISTEN] http://127.0.0.1:${PORT}`));
