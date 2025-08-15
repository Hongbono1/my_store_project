// server.js
import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";

import foodregisterRouter from "./routes/foodregister.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app = express();

// 정적 파일 (ndetail.html 포함)
app.use(express.static(path.join(__dirname, "public")));
app.use(cors());

// API: 푸드레지스터
app.use("/foodregister", foodregisterRouter);

// 헬스체크
app.get("/health", (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`server on :${PORT}`));
