import express from "express";
import multer from "multer";

import {
  listStores,
  searchStore,
  getSlot,
  upsertSlot,
  deleteSlot,
  listCandidates,
  getGrid,
  makeMulterStorage,
  fileFilter,
  whereStore,
} from "../controllers/subcategorymanagerAdController.js";

const router = express.Router();

// ✅ diskStorage
const storage = multer.diskStorage(makeMulterStorage());

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 },
});

// ✅ 프론트 field 이름: image
const uploadSingleImage = upload.single("image");

// ------------------------------
// 목록/검색
// ------------------------------
router.get("/stores", listStores);

// ✅ HTML이 /search 먼저 호출함
router.get("/search", searchStore);

// ✅ alias (HTML이 /search 실패 시 /search-store도 호출 가능)
router.get("/search-store", searchStore);

router.get("/where", whereStore); // ✅ 사업자번호로 등록 위치 조회

// ------------------------------
// 슬롯 읽기/후보/배치/저장/삭제
// ------------------------------
router.get("/slot", getSlot);
router.get("/candidates", listCandidates);
router.get("/grid", getGrid);

router.post("/update", uploadSingleImage, upsertSlot);
router.delete("/delete", deleteSlot);

export default router;
