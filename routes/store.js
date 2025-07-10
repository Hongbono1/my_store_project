// routes/subcategory.js

import express from "express";
import { getStoresBySubcategory } from "../controllers/subcategoryController.js";

const router = express.Router();

// 예: GET /subcategory/밥/stores
router.get("/:id/stores", getStoresBySubcategory);

export default router;