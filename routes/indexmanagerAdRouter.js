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

// ✅ diskStorage 엔진
const storage = multer.diskStorage(makeMulterStorage());

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

// ✅ 어떤 필드명으로 와도 받기 (Unexpected field 방지)
const uploadAny = upload.any();

// ✅ multer 에러를 JSON으로 반환
function multerErrorHandler(err, _req, res, _next) {
  return res.status(400).json({
    success: false,
    ok: false,
    error: err?.message || "upload error",
  });
}

// ===== routes =====
router.get("/slot", getSlot);
router.get("/slots", listSlots);
router.get("/slot-items", listSlotItems);
router.post("/slot", uploadAny, multerErrorHandler, upsertSlot);
router.delete("/slot", deleteSlot);

// 가게 검색 (모달 “가게 연결”)
router.get("/store/search", searchStore);

export default router;
