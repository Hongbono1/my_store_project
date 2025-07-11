import express from "express";
import { getStoresByRestaurant } from "../controllers/restaurantController.js";
const router = express.Router();

router.get("/stores", getStoresByRestaurant);

export default router;
