import express from "express";
import {
  getCategories,
  getSubcategories,
  getStoresByCategory
} from "../controllers/categoryController.js";

const router = express.Router();

router.get("/", getCategories);                     // GET /category
router.get("/:category/sub", getSubcategories);     // GET /category/한식/sub
router.get("/:category/stores", getStoresByCategory); // GET /category/한식/stores

export default router;