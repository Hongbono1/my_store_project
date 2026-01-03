// routes/subcategoryFoodAdRouter.js
import express from "express";
import multer from "multer";

import {
  grid,
  searchStore,
  getSlot,
  upsertSlot,
  deleteSlot,
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

router.get("/grid", grid);
router.get("/search", searchStore);        // ✅ /search 엔드포인트 추가
router.get("/search-store", searchStore);

router.get("/slot", getSlot);
router.post("/update", upload.single("image"), upsertSlot);
router.delete("/delete", deleteSlot);

export default router;
