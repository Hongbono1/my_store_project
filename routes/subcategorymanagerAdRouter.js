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
  grid,
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

// 프론트 field 이름: image
const uploadSingleImage = upload.single("image");

// 목록/검색
router.get("/stores", listStores);
router.get("/search", searchStore);
// alias
router.get("/search-store", searchStore);

// 슬롯 읽기/저장/삭제/후보
router.get("/slot", getSlot);
router.get("/candidates", listCandidates);
router.post("/update", uploadSingleImage, upsertSlot);
router.delete("/delete", deleteSlot);

// ✅ 12칸 grid
router.get("/grid", grid);

// where
router.get("/where", whereSlots);

export default router;
