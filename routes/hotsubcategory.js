// routes/hotsubcategory.js
import express from "express";
import { getHotSubcategories, getHotSubcategoryById } from "../controllers/hotsubcategoryController.js";

const router = express.Router();

// ✅ 전체 또는 카테고리별 서브카테고리 리스트
router.get("/", getHotSubcategories);

// ✅ 단일 상세조회
router.get("/:id", getHotSubcategoryById);

export default router;
