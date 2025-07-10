// routes/category.js
import express from "express";
import {
  getCategories,
  getStoresByCategory
} from "../controllers/categoryController.js";

const router = express.Router();

// ▣ 카테고리 전체 목록
router.get("/", getCategories);

// ▣ 특정 카테고리(필수) · 서브카테고리(옵션) 가게 목록
router.get("/:cat/stores", getStoresByCategory);
//              ▲ 여기를 :cat 으로 변경

export default router;
