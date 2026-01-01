// routes/subcategoryFoodAdRouter.js
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
} from "../controllers/subcategoryFoodAdController.js";

const router = express.Router();

const storage = multer.diskStorage(makeMulterStorage());
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 },
});
const uploadSingleImage = upload.single("image");

// ✅ 프론트가 부르는 경로들
router.get("/grid", grid);

// 프론트가 /search 먼저 치는 경우도 대비(있어도 무해)
router.get("/search", searchStore);
router.get("/search-store", searchStore);

router.get("/slot", getSlot);
router.post("/update", uploadSingleImage, upsertSlot);
router.delete("/delete", deleteSlot);

// 프론트 loadWhere() 대응
router.get("/where", whereSlots);

export default router;
