// routes/subcategoryFoodAdRouter.js
import express from "express";
import { grid, searchStore } from "../controllers/subcategoryFoodAdController.js";

const router = express.Router();

// ✅ 프론트에서 쓰는 엔드포인트 그대로
router.get("/grid", grid);
router.get("/search-store", searchStore);

export default router;
