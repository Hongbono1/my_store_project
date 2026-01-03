// routes/subcategorymanagerAdRouter.js
import express from "express";
import multer from "multer";

import {
  // ✅ 여기 이름들이 컨트롤러 export와 100% 일치해야 함
  grid,
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

router.get("/grid", grid);
router.get("/search", searchStore);        // ✅ /search 엔드포인트 추가
router.get("/search-store", searchStore);

router.get("/slot", getSlot);
router.post("/update", uploadSingleImage, upsertSlot);
router.delete("/delete", deleteSlot);

export default router;
