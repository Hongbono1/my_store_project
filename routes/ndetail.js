// routes/ndetail.js
import { Router } from "express";
import {
  createStore as createStoreHandler,
  getStoreDetail as getStoreDetailHandler
} from "../controllers/ndetailController.js";

const router = Router();

// 등록
router.post("/", createStoreHandler);

// 상세
router.get("/:id", getStoreDetailHandler);

export default router;
EOF