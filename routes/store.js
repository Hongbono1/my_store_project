// routes/store.js
import express from "express";
import {
  getStores,
  getStoreById
  // ❌ getStoresByCategory 빼야 됨!
} from "../controllers/storeController.js";

const router = express.Router();

// ✅ 전체 가게 목록 (옵션: category, type 등)
router.get("/", getStores);            // ex) /store?category=밥&type=한식

// ✅ 단일 가게 상세 페이지
router.get("/:id", getStoreById);      // ex) /store/14

// ✅ 이 라우트는 필요 없음!
// router.get("/:category/stores", getStoresByCategory);

export default router;

