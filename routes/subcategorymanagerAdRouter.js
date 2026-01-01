// routes/subcategorymanagerAdRouter.js
import express from "express";
import multer from "multer";

import {
  listStores,
  searchStore,
  getSlot,
  upsertSlot,
  deleteSlot,
  listCandidates,
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

router.get("/stores", listStores);
router.get("/search", searchStore);

router.get("/slot", getSlot);
router.get("/candidates", listCandidates);
router.post("/update", uploadSingleImage, upsertSlot);
router.delete("/delete", deleteSlot);

export default router;
