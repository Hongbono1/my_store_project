// routes/subcategory.js
import { Router } from "express";
import * as ctrl from "../controllers/subcategoryController.js";

const router = Router();

/* ================== 음식점 ================== */
// 👉 GET /api/subcategory/food?category=한식&sub=밥
router.get("/food", ctrl.getFoodStoresByCategory);

// 👉 GET /api/subcategory/food/best
router.get("/food/best", ctrl.getBestFoodStores);

// 👉 GET /api/subcategory/food/new
router.get("/food/new", ctrl.getNewFoodStores);

/* ================== 통합/뷰티 ================== */
// 👉 GET /api/subcategory/beauty?category=Soap
router.get("/beauty", ctrl.getCombinedStoresByCategory);

// 👉 GET /api/subcategory/beauty/best
router.get("/beauty/best", ctrl.getBestCombinedStores);

// 👉 GET /api/subcategory/beauty/new
router.get("/beauty/new", ctrl.getNewCombinedStores);

export default router;
