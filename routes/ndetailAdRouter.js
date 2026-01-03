// routes/ndetailmanagerAdRouter.js
import express from "express";
import multer from "multer";

import {
  getSlot,
  upsertSlot,
  deleteSlot,
  searchStore,
  makeMulterStorage,
  fileFilter,
} from "../controllers/ndetailmanagerAdController.js";

const router = express.Router();

const storage = multer.diskStorage(makeMulterStorage());
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 },
});

// 프론트 field 이름: image
const uploadSingleImage = upload.single("image");

router.get("/slot", getSlot);
router.get("/search-store", searchStore);
router.post("/update", uploadSingleImage, upsertSlot);
router.delete("/delete", deleteSlot);

export default router;
