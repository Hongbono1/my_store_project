import express from "express";
import { getStorePrideDetail } from "../controllers/storeprideController.js";

const router = express.Router();

router.get("/:id", getStorePrideDetail);

export default router;