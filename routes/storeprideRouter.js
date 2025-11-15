// routes/storeprideRouter.js
import express from "express";
import { getStorePrideList, getStorePrideDetail } from "../controllers/storeprideController.js";

const router = express.Router();

// 리스트
router.get("/list", getStorePrideList);

// 슬라이드용 (동일 데이터)
router.get("/api", getStorePrideList);

// 상세
router.get("/detail/:id", getStorePrideDetail);

export default router;
