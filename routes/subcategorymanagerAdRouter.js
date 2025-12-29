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

// 프론트 field 이름: image
const uploadSingleImage = upload.single("image");

// 목록/검색
router.get("/stores", listStores);
router.get("/search", searchStore);

// ✅ 프론트/기존 curl 호환용 alias
router.get("/search-store", searchStore);

// 슬롯 읽기/저장/삭제/후보
router.get("/slot", getSlot);
router.get("/candidates", listCandidates);
router.post("/update", uploadSingleImage, upsertSlot);
router.delete("/delete", deleteSlot);

export default router;
