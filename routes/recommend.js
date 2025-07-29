// routes/recommend.js
import express from "express";
const router = express.Router();

// GET /recommend/api
router.get("/api", (_req, res) => {
  // 여기서 실제 DB 조회 결과를 담아주세요.
  res.json([
    { id: 1, title: "홍보 가게 A", img: "/uploads/promoA.jpg", category: "식당", address: "서울 강남구", date: "2025-08-01" },
    { id: 2, title: "홍보 가게 B", img: "/uploads/promoB.jpg", category: "카페", address: "서울 마포구", date: "2025-08-05" },
    // … 필요만큼 추가 …
  ]);
});

export default router;
