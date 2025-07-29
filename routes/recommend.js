// routes/recommend.js
import express from "express";
const router = express.Router();

router.get("/api", (_req, res) => {
  // 여기에 실제 DB 조회 결과를 넣으세요
  res.json([
    { id: 1, title: "프로모션 A", img: "/uploads/promoA.jpg", category:"식당", address:"서울" },
    // … 추가 데이터 …
  ]);
});

export default router;
