import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import ndetailRouter from "./routes/ndetail.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// 공통 미들웨어
app.use(cors({ origin: ["https://www.hongbono1.com", "http://localhost:3000"] }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 정적 경로
app.use("/uploads", express.static(path.join(__dirname, "public", "uploads")));
app.use(express.static(path.join(__dirname, "public")));
app.use("/new", express.static(path.join(__dirname, "public2")));

// 필요 폴더 생성
fs.mkdirSync(path.join(__dirname, "public", "uploads"), { recursive: true });
fs.mkdirSync(path.join(__dirname, "data", "stores"), { recursive: true });

// 라우터
app.use("/store", ndetailRouter);

// 헬스/디버그
app.get("/", (_req, res) => res.send("서버 실행 중입니다."));
app.get("/__debug", (_req, res) => {
  res.json({
    cwd: process.cwd(),
    __dirname,
    public: path.join(__dirname, "public"),
    public2: path.join(__dirname, "public2"),
    uploads: path.join(__dirname, "public", "uploads"),
    data: path.join(__dirname, "data", "stores"),
    PORT,
  });
});

// ===== 임시 파일 기반 저장/조회 테스트 (삭제 예정) =====
app.post("/__save", (req, res) => {
  const { id, data } = req.body || {};
  if (!id || typeof id !== "string") return res.status(400).json({ ok: false, msg: "id(string) 필요" });
  const file = path.join(__dirname, "data", "stores", `${id}.json`);
  try {
    fs.writeFileSync(file, JSON.stringify(data ?? {}, null, 2), "utf8");
    return res.json({ ok: true, saved: file });
  } catch (e) {
    console.error("[__save] error:", e);
    return res.status(500).json({ ok: false, msg: "write fail" });
  }
});

app.get("/__load/:id", (req, res) => {
  const id = String(req.params.id || "");
  const file = path.join(__dirname, "data", "stores", `${id}.json`);
  if (!fs.existsSync(file)) return res.status(404).json({ ok: false, msg: "not found" });
  try {
    const json = JSON.parse(fs.readFileSync(file, "utf8"));
    return res.json({ ok: true, data: json });
  } catch (e) {
    console.error("[__load] error:", e);
    return res.status(500).json({ ok: false, msg: "read fail" });
  }
});


// 404 핸들러
app.use((_req, res) => res.status(404).json({ ok: false, message: "Not Found" }));

// 서버 시작
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 서버 실행 중! http://localhost:${PORT}`);
});
