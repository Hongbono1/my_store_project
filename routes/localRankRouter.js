import express from "express";
import { getTop10, getMyTownRank } from "../controllers/localRankController.js";

const router = express.Router();

// 전국 Top 10
router.get("/top10", getTop10);

// 내 동네 순위
router.get("/mytown", getMyTownRank);

export default router;
