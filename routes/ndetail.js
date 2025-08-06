import express from "express";
import { getStoreDetail } from "../controllers/storeController.js";

const router = express.Router();

// 상세조회 라우트
router.get("/:id", getStoreDetail);

export default router;
