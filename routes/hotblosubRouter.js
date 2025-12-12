// routes/hotblosubRouter.js
import express from "express";
import { getHotblosubList } from "../controllers/hotblosubController.js";

const router = express.Router();

// GET /api/hotsubcategory
router.get("/", getHotblosubList);

export default router;
