// routes/subcategory.js
import express from "express";
import { getStoresBySubcategory } from "../controllers/subcategoryController.js";

const router = express.Router();

// GET /subcategory/:sub/stores
router.get("/:sub/stores", getStoresBySubcategory);

export default router;
