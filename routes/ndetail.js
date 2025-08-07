import express from "express";
import {
  createStore,        // ncombinedregister.html 등록 처리
  getStoreById as getStoreDetail, // ndetail.html 상세 조회
} from "../controllers/storeController.js";

const router = express.Router();

// POST /store (등록)
router.post("/", createStore);

// GET /store/:id (상세 조회)
router.get("/:id", getStoreDetail);

export default router;
