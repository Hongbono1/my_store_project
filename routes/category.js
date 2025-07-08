import express from "express";
import {
  getCategories,
  getStoresByCategory
} from "../controllers/categoryController.js";

const router = express.Router();

// 1) 전체 카테고리 목록 조회 → GET /category
router.get("/", getCategories);

// 2) 특정 카테고리 내 스토어 조회 → GET /category/:id/stores
router.get("/:id/stores", getStoresByCategory);

export default router;

