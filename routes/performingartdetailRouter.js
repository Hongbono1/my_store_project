import express from "express";
import { getPerformingArtById } from "../controllers/performingartdetailController.js";

const router = express.Router();

// 공연/예술 상세 조회
router.get("/:id", getPerformingArtById);

export default router;
