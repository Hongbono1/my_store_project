// routes/hotsubcategory.js
import express from "express";
import { getHotSubcategories } from "../controllers/hotsubcategoryController.js";

const router = express.Router();

/**
 * GET /api/hotsubcategory
 * @query category=food|beauty|life|event|all
 * @query sort=latest|default
 * @query search=검색어
 */
router.get("/", getHotSubcategories);

export default router;
