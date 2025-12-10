// routes/subcategory.js
import { Router } from "express";
import * as ctrl from "../controllers/subcategoryController.js";

const router = Router();

/* ================== 음식점 ================== */
// 음식점 업종별 조회
// 👉 GET /api/subcategory/food?category=한식
router.get("/food", ctrl.getFoodStoresByCategory);

// 음식점 Best Seller
// 👉 GET /api/subcategory/food/best
router.get("/food/best", ctrl.getBestFoodStores);

// 음식점 New registration
// 👉 GET /api/subcategory/food/new
router.get("/food/new", ctrl.getNewFoodStores);


/* ================== 통합/뷰티 ================== */
// 뷰티/통합 서브카테고리 조회
// 👉 GET /api/subcategory/beauty?category=Soap
router.get("/beauty", ctrl.getCombinedStoresByCategory);

// 통합 Best Seller
// 👉 GET /api/subcategory/beauty/best
router.get("/beauty/best", ctrl.getBestCombinedStores);

// 통합 New registration
// 👉 GET /api/subcategory/beauty/new
router.get("/beauty/new", ctrl.getNewCombinedStores);

export default router;
