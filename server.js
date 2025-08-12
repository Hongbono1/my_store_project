// server.js
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import foodregisterRouter from "./routes/foodregister.js";

const app = express();
const PORT = process.env.PORT || 3000;

// 기본 미들웨어
app.use(cors({ origin: ["https://www.hongbono1.com", "http://localhost:3000"] }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 정적: public2만 사용
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(process.cwd(), "public2")));
app.use("/uploads", express.static(path.join(process.cwd(), "public2", "uploads")));

// 사업자번호 중계 (/verify-biz)
app.post("/verify-biz", async (req, res) => {
  try {
    const key = process.env.ODCLOUD_SERVICE_KEY; // ← .env와 동일한 이름
    if (!key) {
      console.error("[/verify-biz] ODCLOUD_SERVICE_KEY missing");
      return res.status(500).json({ error: "ODCLOUD_SERVICE_KEY is not set" });
    }

    const body = req.body?.b_no ? { b_no: req.body.b_no } : req.body;
    if (!body || !Array.isArray(body.b_no) || body.b_no.length === 0) {
      console.error("[/verify-biz] invalid body:", req.body);
      return res.status(400).json({ error: 'invalid body; expected { b_no: ["##########"] }' });
    }

    const url = `https://api.odcloud.kr/api/nts-businessman/v1/status?serviceKey=${encodeURIComponent(key)}`;

    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json;charset=UTF-8" },
      body: JSON.stringify(body),
    });

    const text = await r.text();
    if (!r.ok) {
      console.error("[/verify-biz] upstream", r.status, text);
      res.status(r.status);
      try { return res.json(JSON.parse(text)); }
      catch { return res.type("text/plain").send(text); }
    }

    try { return res.json(JSON.parse(text)); }
    catch (e) {
      console.error("[/verify-biz] JSON parse err:", e, text);
      return res.status(502).type("text/plain").send("Bad upstream JSON");
    }
  } catch (err) {
    console.error("[/verify-biz] error:", err);
    return res.status(500).json({ error: "verify-biz failed" });
  }
});

// foodregister 라우터만 사용
app.use("/foodregister", foodregisterRouter);

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
