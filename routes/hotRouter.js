// routes/hotRouter.js
import express from "express";
import { getHotSummary } from "../controllers/hotController.js";

const router = express.Router();

// GET /api/hot/summary
router.get("/summary", getHotSummary);

export default router;
