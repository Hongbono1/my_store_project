import express from "express";
import { getStoresBySubcategory } from "../controllers/subcategoryController.js";

const router = express.Router();
router.get("/:sub/stores", getStoresBySubcategory);
export default router;