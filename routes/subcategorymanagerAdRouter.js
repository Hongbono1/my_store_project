// routes/subcategorymanagerAdRouter.js
import express from "express";
import multer from "multer";

import {
  getGrid,
  searchStore,
  getSlot,
  upsertSlot,
  deleteSlot,
  makeMulterStorage,
  fileFilter,
} from "../controllers/subcategorymanagerAdController.js";

const router = express.Router();

const storage = multer.diskStorage(makeMulterStorage());
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 },
});
const uploadSingleImage = upload.single("image");

// ✅ 기존 매니저 엔드포인트(이름만 실제 컨트롤러 export에 맞춤)
router.get("/grid", getGrid);
router.get("/search-store", searchStore);

router.get("/slot", getSlot);
router.post("/update", uploadSingleImage, upsertSlot);
router.delete("/delete", deleteSlot);

export default router;
