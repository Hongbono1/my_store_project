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

// ✅ 핵심: diskStorage로 감싸서 “multer storage 엔진” 형태로 만들어야 함
const storage = multer.diskStorage(makeMulterStorage());

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

const uploadFields = upload.fields([
  { name: "image", maxCount: 1 },
  { name: "slotImage", maxCount: 1 },
  { name: "file", maxCount: 1 },
]);

router.get("/slot", getSlot);
router.get("/slots", listSlots);
router.get("/slot-items", listSlotItems);

router.post("/slot", uploadFields, upsertSlot);
router.delete("/slot", deleteSlot);

router.get("/store/search", searchStore);

export default router;
