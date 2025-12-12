// routes/hotblosubRouter.js
import express from "express";
import { getHotSubList } from "../controllers/hotblosubController.js";

const router = express.Router();

// GET /api/hotsubcategory
router.get("/", getHotSubList);

export default router;
