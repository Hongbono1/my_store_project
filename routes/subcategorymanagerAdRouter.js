// routes/subcategorymanagerAdRouter.js
import express from "express";
import multer from "multer";

import {
  listStores,
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

// 목록/검색
router.get("/stores", listStores);
router.get("/search", searchStore);

// 슬롯 읽기/저장/삭제
router.get("/slot", getSlot);
router.post("/update", uploadSingleImage, upsertSlot);
router.delete("/delete", deleteSlot);

export default router;
