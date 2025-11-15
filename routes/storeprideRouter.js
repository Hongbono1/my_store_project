// routes/storeprideRouter.js
import express from "express";
import { getStorePrideList, getStorePrideDetail } from "../controllers/storeprideController.js";

const router = express.Router();

// 리스트
router.get("/list", getStorePrideList);

// 상세
router.get("/detail/:id", getStorePrideDetail);

export default router;
