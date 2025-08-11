
// routes/ndetail.js
import { Router } from "express";
import { createStore, getStoreDetail } from "../controllers/ndetailController.js";

const router = Router();

// 등록
router.post("/", createStore);

// 상세
router.get("/:id", getStoreDetail);

export default router;
