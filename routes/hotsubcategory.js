// routes/hotsubcategory.js
import express from "express";
import { getHotSubcategories, getHotSubcategoryById } from "../controllers/hotsubcategoryController.js";

const router = express.Router();

// ✅ 전체 또는 카테고리별 목록
router.get("/", getHotSubcategories);

// ✅ 단일 상세 조회
router.get("/:id", getHotSubcategoryById);

export default router;

