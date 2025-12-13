// routes/indexmanagerAdRouter.js
import express from "express";
import multer from "multer";
import {
  getSlot,
  listSlots,
  listSlotItems,
  upsertSlot,
  deleteSlot,
  searchStore,
  makeMulterStorage,
  fileFilter,
} from "../controllers/indexmanagerAdController.js";

const router = express.Router();

const upload = multer({
  storage: makeMulterStorage(),
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// ✅ 파일 필드 이름 여러개 허용
const uploadFields = upload.fields([
  { name: "image", maxCount: 1 },
  { name: "slotImage", maxCount: 1 },
  { name: "file", maxCount: 1 },
]);

// 조회
router.get("/slot", getSlot);
router.get("/slots", listSlots);

// ✅ 후보 전체(우선순위 관리용)
router.get("/slot-items", listSlotItems);

// 저장/삭제
router.post("/slot", uploadFields, upsertSlot);
router.delete("/slot", deleteSlot);

// 가게 검색
router.get("/store/search", searchStore);

export default router;
