// routes/ncategory2managerAdRouter.js
import express from "express";
import multer from "multer";

import {
  getSlot,
  listSlots,
  listSlotItems,     // ✅ 추가
  upsertSlot,
  deleteSlot,
  searchStore,
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

// ✅ multer 에러를 JSON으로 반환 (에러 미들웨어)
function multerErrorHandler(err, _req, res, _next) {
  return res.status(400).json({
    success: false,
    error: err?.message || "upload error",
  });
}

// ===== API =====
router.get("/slot", getSlot);
router.get("/slots", listSlots);
router.get("/slot-items", listSlotItems);  // ✅ 추가 (404 해결)
router.get("/search-store", searchStore);

router.post("/slot", uploadAny, upsertSlot);
router.delete("/slot", deleteSlot);

// ✅ 반드시 라우터 맨 아래에 에러 핸들러 등록
router.use(multerErrorHandler);

export default router;
