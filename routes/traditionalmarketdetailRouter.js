import express from "express";
import { getTraditionalMarketById, getMarketList } from "../controllers/traditionalmarketdetailController.js";

const router = express.Router();

// 목록 조회
router.get("/", getMarketList);

// 상세 조회
router.get("/:id", getTraditionalMarketById);

export default router;
