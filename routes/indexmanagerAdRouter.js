// routes/indexmanagerAdRouter.js
import { Router } from "express";
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

const router = Router();

/**
 * ✅ 중요:
 * - makeMulterStorage() 는 { destination, filename } "옵션 객체"를 리턴
 * - diskStorage(옵션) => "storage 엔진" 생성 (엔진에 _handleFile 존재)
 */
const storage = multer.diskStorage(makeMulterStorage());

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB
  },
});

/** ✅ 프론트에서 어떤 name으로 보내도 받게 (image/slotImage/file) */
function uploadWithCatch(req, res, next) {
  const handler = upload.fields([
    { name: "image", maxCount: 1 },
    { name: "slotImage", maxCount: 1 },
    { name: "file", maxCount: 1 },
  ]);

  handler(req, res, (err) => {
    if (err) {
      console.error("[indexmanagerAdRouter] multer error:", err);
      return res.status(400).json({
        success: false,
        error: err.message || "파일 업로드 오류",
      });
    }
    next();
  });
}

// 조회
router.get("/slot", getSlot);
router.get("/slots", listSlots);
router.get("/slot-items", listSlotItems);

// 가게 검색
router.get("/store/search", searchStore);

// 저장(업로드 포함)
router.post("/slot", uploadWithCatch, upsertSlot);

// 삭제
router.delete("/slot", deleteSlot);

export default router;
