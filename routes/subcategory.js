// routes/subcategory.js
import { Router } from "express";
import * as ctrl from "../controllers/subcategoryController.js";

const router = Router();

// 음식점 업종별 조회
// 👉 GET /api/subcategory/food?category=한식
router.get("/food", ctrl.getFoodStoresByCategory);

// 뷰티/통합 서브카테고리 조회
// 👉 GET /api/subcategory/beauty?category=Soap
router.get("/beauty", ctrl.getCombinedStoresByCategory);

// Best Seller (조회수 or created_at 기준 정렬된 가게)
// 👉 GET /api/subcategory/best
router.get("/best", ctrl.getBestStores);

// New registration (최근 일주일 등록된 가게)
// 👉 GET /api/subcategory/new
router.get("/new", ctrl.getNewStores);

export default router;
