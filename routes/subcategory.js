// routes/category.js
import express from "express";
import {
  getCategories,
  getSubcategories,
  getStoresByCategory
} from "../controllers/categoryController.js";

const router = express.Router();

/* ───────────────────────────────
 * 1) 카테고리 목록
 *    GET /category
 * ─────────────────────────────── */
router.get("/", getCategories);

/* ───────────────────────────────
 * 2) 카테고리별 소제목 목록
 *    GET /category/:category/sub
 * ─────────────────────────────── */
router.get("/:category/sub", getSubcategories);

/* ───────────────────────────────
 * 3) 카테고리별 가게 목록
 *    GET /category/:category/stores?subcategory=밥
 * ─────────────────────────────── */
router.get("/:category/stores", getStoresByCategory);

export default router;
