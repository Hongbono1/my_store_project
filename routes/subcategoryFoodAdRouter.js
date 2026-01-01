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

router.get("/grid", grid);
router.get("/search-store", searchStore);

router.get("/slot", getSlot);
router.get("/where", whereSlots); // ✅ 필요 없으면 이 줄+import 제거해도 됨

router.post("/update", uploadSingleImage, upsertSlot);
router.delete("/delete", deleteSlot);

export default router;
