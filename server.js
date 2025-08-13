// server.js
import "dotenv/config";                  // ← .env를 항상 로드 (PM2에서도 보장)
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";

import foodregisterRouter from "./routes/foodregister.js"; // ← 라우터 경로 확인!

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// 부팅 로그 (진단용)
console.log("[BOOT] PORT=", process.env.PORT || 3000);
console.log("[BOOT] DATABASE_URL len =", (process.env.DATABASE_URL || "").length);
console.log("[BOOT] ODCLOUD_SERVICE_KEY len =", (process.env.ODCLOUD_SERVICE_KEY || "").length);

// CORS (필요 시)
const origins = (process.env.CORS_ORIGINS || "").split(",").filter(Boolean);
if (origins.length) {
  app.use(cors({ origin: origins, credentials: true }));
}

// JSON/URLENCODED 파서 (멀티파트는 multer가 처리하므로 OK)
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// 정적 파일: public2가 루트
app.use(express.static(path.join(process.cwd(), "public2"), { index: false }));

/** ---------------- /verify-biz (ODCloud 프록시) ---------------- */
app.post("/verify-biz", async (req, res) => {
  try {
    const key = process.env.ODCLOUD_SERVICE_KEY || process.env.BIZ_API_KEY;
    if (!key) return res.status(500).json({ error: "ODCLOUD_SERVICE_KEY is not set" });

    const body = req.body?.b_no ? { b_no: req.body.b_no } : req.body;
    if (!body || !Array.isArray(body.b_no) || body.b_no.length === 0) {
      return res.status(400).json({ error: 'invalid body; expected { b_no: ["##########"] }' });
    }

    // 키가 이미 인코딩되어 있으면 그대로, 아니면 인코딩
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
