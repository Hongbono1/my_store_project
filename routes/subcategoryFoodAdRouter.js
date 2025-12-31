// routes/subcategoryFoodAdRouter.js
import express from "express";
import { grid, searchStore } from "../controllers/subcategoryFoodAdController.js";

const router = express.Router();

router.get("/grid", grid);
router.get("/search-store", searchStore);

export default router;
