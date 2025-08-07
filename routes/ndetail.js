import express from "express";
import { createStore } from "../controllers/storeController.js";
import { createStore }   from "../controllers/ndetailController.js";

const router = express.Router();

// POST /store  → 등록 (FormData)
router.post("/", createStore);

// GET /store/:id  → 상세(DB)
router.get("/:id", getStoreDetail);

export default router;
