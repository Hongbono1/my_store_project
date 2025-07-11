// routes/restaurant.js
import express from "express";
import { getStoresByCategory } from "../controllers/restaurantController.js";

const router = express.Router();

router.get("/:category/stores", getStoresByCategory);

export default router;
