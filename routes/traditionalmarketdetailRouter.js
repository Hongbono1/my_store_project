import express from "express";
import { getTraditionalMarketById } from "../controllers/traditionalmarketdetailController.js";

const router = express.Router();

// 상세 조회
router.get("/:id", getTraditionalMarketById);

export default router;
