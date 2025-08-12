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
    const serviceKey = process.env.BIZ_API_KEY;
    if (!serviceKey) return res.status(500).json({ error: "BIZ_API_KEY is not set" });

    // 클라이언트에서 { b_no: ["1234567890"] } 형식 권장
    const body = req.body?.b_no ? { b_no: req.body.b_no } : req.body;

    const url = `https://api.odcloud.kr/api/nts-businessman/v1/status?serviceKey=${encodeURIComponent(serviceKey)}`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json;charset=UTF-8" },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    return res.status(r.ok ? 200 : r.status).json(data);
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
