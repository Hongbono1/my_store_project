// routes/subcategoryFoodAdRouter.js
import express from "express";
import { grid, searchStore } from "../controllers/subcategoryFoodAdController.js";

const router = express.Router();

// ✅ grid
router.get("/grid", grid);

// ✅ search
router.get("/search-store", searchStore);

export default router;
