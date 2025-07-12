// routes/restaurant.js
import express from "express";
import path from "path";
import { getStoresByCategory } from "../controllers/restaurantController.js";

const router = express.Router();

// ✅ 레스토랑 메인 페이지
router.get("/", (req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "restaurant.html"));
});

// ✅ 카테고리별 가게 목록
router.get("/:category/stores", getStoresByCategory);
router.get("/ads", getPowerAds);   // ★ 추가

export default router;