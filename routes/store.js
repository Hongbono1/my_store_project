// routes/store.js
import express from "express";
import { getStoreById } from "../controllers/storeController.js";

const router = express.Router();
router.get("/:id", getStoreById);   // GET /store/14
export default router;

