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


app.post("/verify-biz", async (req, res) => {
    try {
        const raw = Array.isArray(req.body?.b_no) ? req.body.b_no[0] : "";
        const b_no = String(raw || "").replace(/[^\d]/g, "").slice(0, 10);
        if (!b_no) {
            return res.status(400).json({ ok: false, message: "b_no required" });
        }

        // 🔹 실연동 키 없으면: 목업으로 항상 '계속사업자' 처리 (프론트가 기대하는 odcloud 포맷)
        if (!process.env.BIZ_API_KEY) {
            return res.status(200).json({
                status_code: "OK",
                data: [
                    {
                        b_no,
                        b_stt_cd: "01",
                        b_stt: "계속사업자",
                        b_nm: "", // 필요시 상호를 여기로 채우면 자동 입력됨
                    },
                ],
            });
        }

        // 🔹 실연동 키가 있으면: odcloud 프록시
        const url =
            "https://api.odcloud.kr/api/nts-businessman/v1/status?serviceKey=" +
            encodeURIComponent(process.env.BIZ_API_KEY);

        const upstream = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json; charset=utf-8" },
            body: JSON.stringify({ b_no: [b_no] }),
        });

        // 네트워크 오류/HTTP 오류 대비
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


// 정적 파일 (ndetail.html 포함)
app.use(express.static(path.join(__dirname, "public2"), { extensions: ["html"] }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(cors());
app.use(express.json({ limit: "2mb" }));

// API: 푸드레지스터
app.use("/foodregister", foodregisterRouter);

// 헬스체크
app.get("/health", (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`server on :${PORT}`));
