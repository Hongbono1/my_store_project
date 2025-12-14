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

/**
 * ✅ 핵심 변경:
 * - 프론트에서 어떤 name으로 파일을 보내든 무조건 받기 위해 upload.any() 사용
 * - 컨트롤러에서 req.files(Array)도 지원하도록 같이 수정함
 */
router.get("/slot", getSlot);
router.get("/slots", listSlots);
router.get("/slot-items", listSlotItems);

router.post("/slot", upload.any(), upsertSlot);
router.delete("/slot", deleteSlot);

router.get("/store/search", searchStore);

export default router;
