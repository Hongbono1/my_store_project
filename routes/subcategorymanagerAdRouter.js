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

// ✅ 프론트(field): image
const uploadSingleImage = upload.single("image");

// grid / search
router.get("/grid", grid);
router.get("/search", searchStore);
router.get("/search-store", searchStore); // 호환

// slot / where
router.get("/slot", getSlot);
router.get("/where", whereSlots);

// update / delete
router.post("/update", uploadSingleImage, upsertSlot);
router.delete("/delete", deleteSlot);

export default router;
