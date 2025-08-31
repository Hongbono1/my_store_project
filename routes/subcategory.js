// routes/subcategory.js
import { Router } from "express";
import * as ctrl from "../controllers/subcategoryController.js";

const router = Router();

// 음식점 업종별 조회
router.get("/food", ctrl.getFoodStoresByCategory);

// 뷰티/통합 서브카테고리 조회
router.get("/combined/:category", ctrl.getCombinedStoresByCategory);

export default router;
