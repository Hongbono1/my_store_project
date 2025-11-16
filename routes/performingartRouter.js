import express from "express";
import { getAllPerformingArts } from "../controllers/performingartController.js";

const router = express.Router();

// 공연/예술 목록 조회
router.get("/", getAllPerformingArts);

export default router;
