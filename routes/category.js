// routes/category.js
import express from "express";
import {
  getCategories,        // 전체 카테고리 목록     ─ GET /category
  getSubcategories,     // 서브카테고리 목록      ─ GET /category/:cat/sub
  getStoresByCategory,  // 가게 목록 (옵션 필터)  ─ GET /category/:cat/stores
} from "../controllers/categoryController.js";

const router = express.Router();

/* ───────────────────────────────
 * 1) 카테고리 리스트
 *    GET /category
 * ─────────────────────────────── */
router.get("/", getCategories);

/* ───────────────────────────────
 * 2) 특정 카테고리의 서브카테고리(분야) 리스트
 *    GET /category/:cat/sub
 *      예)  /category/한식/sub  → ["밥","국","면"]
 * ─────────────────────────────── */
router.get("/:cat/sub", getSubcategories);

/* ───────────────────────────────
 * 3) 특정 카테고리(필수) + 서브카테고리(옵션) 가게 리스트
 *    GET /category/:cat/stores
 *      전체 한식      → /category/한식/stores
 *      한식·밥만      → /category/한식/stores?subcategory=밥
 * ─────────────────────────────── */
router.get("/:cat/stores", getStoresByCategory);

export default router;
