import express from "express";
import { getStoresByCategory } from "../controllers/categoryController.js";

const router = express.Router();
// /store?category=한식
router.get("/", getStoresByCategory);
export default router;