// routes/store.js
import express from "express";
import { getStoreById } from "../controllers/storeController.js";

const router = express.Router();
router.get("/store/:id", getStoreById);  
export default router;

