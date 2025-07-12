import express from "express";
import path from "path";
import {
  getStoresByCategory,
  getPowerAds,        // ★ 여기에 추가
} from "../controllers/restaurantController.js";

const router = express.Router();

// 레스토랑 메인 페이지
router.get("/", (req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "restaurant.html"));
});

// 파워 광고 API
router.get("/ads", getPowerAds);

// 카테고리별 가게 목록 API
router.get("/:category/stores", getStoresByCategory);

export default router;
