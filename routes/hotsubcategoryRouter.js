import express from "express";
import { getHotSubTheme } from "../controllers/hotsubcategoryController.js";

const router = express.Router();

// 오늘의 테마 리스트
router.get("/sub/theme", getHotSubTheme);

export default router;
