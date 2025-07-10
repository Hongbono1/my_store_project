import express from "express";
import { getStoreById, getStores } from "../controllers/storeController.js";

const router = express.Router();

router.get("/", getStores);             // GET /store?category=밥&type=한식&subcategory=비빔밥
router.get("/:id", getStoreById);       // GET /store/14

export default router;
