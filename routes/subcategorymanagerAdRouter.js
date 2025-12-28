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
} from "../controllers/subcategorymanagerAdController.js";

const router = express.Router();

// ✅ diskStorage
const storage = multer.diskStorage(makeMulterStorage());

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

// ✅ Unexpected field 방지 (필드명 자유)
const uploadAny = upload.any();

function multerErrorHandler(err, _req, res, _next) {
  return res.status(400).json({
    success: false,
    error: err?.message || "upload error",
  });
}

// =========================
// ✅ 조회
// =========================
router.get("/slot", getSlot);
router.get("/slots", listSlots);
router.get("/slot-items", listSlotItems);

// =========================
// ✅ 저장/삭제
// =========================
router.post("/slot", uploadAny, upsertSlot, multerErrorHandler);
router.delete("/slot", deleteSlot);

// =========================
// ✅ 가게 검색(모달)
/// search-store?q=__all__&mode=combined|food
// =========================
router.get("/search-store", searchStore);

export default router;
