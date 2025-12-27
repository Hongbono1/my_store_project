import express from "express";
import multer from "multer";

import {
  getSlot,
  listSlots,
  listSlotItems,
  upsertSlot,
  deleteSlot,
  searchStore,
  getCategoryTree,
  makeMulterStorage,
  fileFilter,
} from "../controllers/ncategory2managerAdController.js";

const router = express.Router();

// ✅ diskStorage
const storage = multer.diskStorage(makeMulterStorage());

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 },
});

// ✅ Unexpected field 방지
const uploadAny = upload.any();

function multerErrorHandler(err, _req, res, _next) {
  return res.status(400).json({
    success: false,
    ok: false,
    error: err?.message || "upload error",
  });
}

// ===== API =====
router.get("/slot", getSlot);
router.get("/slots", listSlots);
router.get("/slot-items", listSlotItems);

router.get("/search-store", searchStore);

// ✅ 이 라인이 에러 주범이었음 (import가 없으면 바로 ReferenceError)
router.get("/category-tree", getCategoryTree);

router.post("/slot", uploadAny, upsertSlot, multerErrorHandler);
router.delete("/slot", deleteSlot);

export default router;
