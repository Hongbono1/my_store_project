import express from "express";
import { getHotStores } from "../controllers/hotController.js";

const router = express.Router();

// 🔥 가장 핫한 우리동네
router.get("/", getHotStores);

export default router;
