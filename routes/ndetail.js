import express from "express";
import {
  createStore,      // 등록 (POST /store)
  getStoreDetail,   // 상세 (GET /store/:id)
} from "../controllers/ndetailController.js";

const router = express.Router();

router.post("/", createStore);      // POST /store
router.get("/:id", getStoreDetail);  // GET  /store/:id

export default router;
