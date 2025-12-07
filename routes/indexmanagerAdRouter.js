// routes/indexmanagerAdRouter.js
import express from "express";
import { upload } from "../middlewares/upload.js";

import {
  uploadIndexAd,
  saveIndexStoreAd,
  getIndexSlot,
  getIndexTextSlot,
  saveIndexTextSlot,
  getBestPickSlots,
  searchStoreByBiz,      // ✅ 추가된 함수
  connectStoreToSlot,    // ✅ 추가된 함수  
  deleteSlot,            // ✅ 추가된 함수
} from "../controllers/indexmanagerAdController.js";

const router = express.Router();

// 🔸 이미지 업로드
router.post("/upload", upload.single("image"), uploadIndexAd);

// 🔸 가게 연결 (기존)
router.post("/store", saveIndexStoreAd);

// 🔸 슬롯 조회
router.get("/slot", getIndexSlot);

// 🔸 텍스트 슬롯
router.get("/text/get", getIndexTextSlot);
router.post("/text/save", saveIndexTextSlot);

// 🔸 Best Pick 목록
router.get("/best-pick", getBestPickSlots);

// ✅ 새로 추가된 API들
router.get("/store/search", searchStoreByBiz);
router.post("/store/connect", connectStoreToSlot);
router.delete("/slot", deleteSlot);

export default router;
