import express from "express";
import { getHotNeighborhoodAds } from "../controllers/hotController.js";
const router = express.Router();

router.get("/api", getHotNeighborhoodAds);

export default router;
