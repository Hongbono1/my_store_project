// routes/foodSubAdRouter.js
import express from "express";
import { getFoodSubcategoryStores } from "../controllers/foodSubAdController.js";

const router = express.Router();

/**
 * /api/subcategory/:type
 *  - /api/subcategory/food?category=분식
 *  - /api/subcategory/beauty?category=네일
 */
router.get("/:type", getFoodSubcategoryStores);

export default router;
