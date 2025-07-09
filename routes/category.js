import express from "express";
import {
  getCategories,
  getStoresByCategory
} from "../controllers/categoryController.js";

const router = express.Router();

// 카테고리 전체
router.get("/", getCategories);

// 특정 카테고리 내 가게 목록
router.get("/:category/stores", getStoresByCategory);

export default router;
