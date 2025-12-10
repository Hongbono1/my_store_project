// routes/indexmanagerAdRouter.js
import express from "express";
import {
  getSlot,
  upsertSlot,
  searchStores,
  uploadSlotImage,
} from "../controllers/indexmanagerAdController.js";

const router = express.Router();

/**
 * ✅ 슬롯 단건 조회
 * - indexmanager.html 미리보기/모달 프리필용
 * - query: page, position
 */
router.get("/slot", getSlot);

/**
 * ✅ 슬롯 저장(이미지/가게연결 통합)
 * - indexmanager.html 저장 버튼용
 * - FormData 지원
 * - image field name 혼용 대응:
 *   - image
 *   - slotImage
 */
router.post("/slot", uploadSlotImage, upsertSlot);

/**
 * ✅ 가게 검색
 * - query: bizNo, name (혹은 businessName)
 * - indexmanager.html 가게 연결 모달 검색용
 */
router.get("/store/search", searchStores);

export default router;
