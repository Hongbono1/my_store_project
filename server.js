console.log("🚨 서버 시작 - PGHOST:", process.env.PGHOST);

const express = require("express");
const path = require("path");
const multer = require("multer");
const db = require("./db"); // db.js 불러오기

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ DB 연결 확인용 라우터
app.get("/", async (req, res) => {
  try {
    const result = await db.query("SELECT NOW()");
    res.send("✅ DB 연결 성공! 현재 시간: " + result.rows[0].now);
  } catch (err) {
    console.error("❌ DB 연결 실패:", err);
    res.status(500).send("DB 연결 실패");
  }
});

app.listen(PORT, () => {
  console.log(`🚀 서버 실행 중: 포트 ${PORT}`);
});
