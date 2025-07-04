import express from "express";
import {
  getCategories,
  getStoresByCategory
} from "../controllers/categoryController.js";

const router = express.Router();

/* /category           → 카테고리 전체 */
router.get("/",      getCategories);

/* /category/식사/stores → 해당 카테고리 가게 목록 */
router.get("/:categoryName/stores", getStoresByCategory);

export default router;
