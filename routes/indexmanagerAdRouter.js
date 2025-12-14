// routes/indexmanagerAdRouter.js
import express from "express";
import multer from "multer";
import {
  getSlot,
  listSlots,
  listSlotItems,
  upsertSlot,
  deleteSlot,
  searchStore,
  makeMulterStorage,
  fileFilter,
} from "../controllers/indexmanagerAdController.js";

const router = express.Router();

/**
 * ✅ 핵심
 * - makeMulterStorage()가
 *   1) diskStorage 엔진(_handleFile 있음)을 주면 그대로 사용
 *   2) diskStorage 옵션({destination, filename} 등)을 주면 diskStorage로 감싸서 엔진 생성
 */
const storageCandidate = makeMulterStorage();
const storage =
  storageCandidate && typeof storageCandidate._handleFile === "function"
    ? storageCandidate
    : multer.diskStorage(storageCandidate || {});

const upload = multer({
  storage, // ✅ 반드시 'storage 엔진'이 들어가야 함
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// ✅ 파일 필드 이름 여러개 허용
const uploadFields = upload.fields([
  { name: "image", maxCount: 1 },
  { name: "slotImage", maxCount: 1 },
  { name: "file", maxCount: 1 },
]);

// 조회
router.get("/slot", getSlot);
router.get("/slots", listSlots);

// ✅ 후보 전체(우선순위 관리용)
router.get("/slot-items", listSlotItems);

// 저장/삭제
router.post("/slot", uploadFields, upsertSlot);
router.delete("/slot", deleteSlot);

// 가게 검색
router.get("/store/search", searchStore);

export default router;
