// routes/hotblog.js
import express from "express";
import { getAllHotblogs, getRandomHotblog } from "../controllers/hotblogController.js";

const router = express.Router();

// 전체 목록
router.get("/", getAllHotblogs);

// 랜덤 1개
router.get("/random-hotblog", getRandomHotblog);

export default router;
