import express from "express";
import { insertStorePride, getStorePrideById } from "../controllers/storeprideController.js";
const router = express.Router();

router.post("/register", insertStorePride);   // 등록(POST)
router.get("/:id", getStorePrideById);        // 상세조회(GET)

export default router;
