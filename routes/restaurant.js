// routes/restaurant.js
import express from "express";
import path from "path";
import { getStoresByCategory } from "../controllers/restaurantController.js";
// import { getPowerAds } from "../controllers/restaurantController.js"; // ← 파워광고는 나중에 활성화

const router = express.Router();

/* ────────────── 페이지 ────────────── */
// 레스토랑 메인 페이지
router.get("/", (req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "restaurant.html"));
});

/* ────────────── API ────────────── */
// 파워 광고 API (임시 비활성화)
// router.get("/ads", getPowerAds);

// 카테고리별 가게 목록
router.get("/:category/stores", getStoresByCategory);

export default router;
