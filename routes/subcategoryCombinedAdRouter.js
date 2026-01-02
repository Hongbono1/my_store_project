// routes/subcategoryCombinedAdRouter.js
import express from "express";
import multer from "multer";

import {
  grid,
  searchStore,
  getSlot,
  upsertSlot,
  deleteSlot,
  whereSlots,
  makeMulterStorage,
  fileFilter,
} from "../controllers/subcategoryCombinedAdController.js";

const router = express.Router();

const storage = multer.diskStorage(makeMulterStorage());
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 },
});

router.get("/grid", grid);
router.get("/search-store", searchStore);

router.get("/slot", getSlot);
router.post("/update", upload.single("image"), upsertSlot);
router.delete("/delete", deleteSlot);

// 옵션(없어도 됨) - 통합 가게 존재 확인
router.get("/where", whereSlots);

export default router;
