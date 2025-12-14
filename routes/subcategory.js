// routes/subcategory.js
import { Router } from "express";
import * as ctrl from "../controllers/subcategoryController.js";

const router = Router();

/* ================== 음식점 ================== */
router.get("/food", ctrl.getFoodStoresByCategory);
router.get("/food/best", ctrl.getBestFoodStores);
router.get("/food/new", ctrl.getNewFoodStores);

/* ================== 통합/뷰티 ================== */
router.get("/beauty", ctrl.getCombinedStoresByCategory);
router.get("/beauty/best", ctrl.getBestCombinedStores);
router.get("/beauty/new", ctrl.getNewCombinedStores);

export default router;
