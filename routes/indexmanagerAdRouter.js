// routes/indexmanagerAdRouter.js
import express from "express";
import multer from "multer";

import {
  getSlot,
  listSlots,
  upsertSlot,
  deleteSlot,
  searchStore,
  makeMulterStorage,
  fileFilter,
} from "../controllers/indexmanagerAdController.js";

const router = express.Router();

// ✅ multer 설정 (컨트롤러의 저장 경로/파일명 규칙 그대로 사용)
const storage = multer.diskStorage(makeMulterStorage());

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// ✅ 파일 필드명 여러개 허용: image | slotImage | file
const uploadFields = upload.fields([
  { name: "image", maxCount: 1 },
  { name: "slotImage", maxCount: 1 },
  { name: "file", maxCount: 1 },
]);

// ✅ fields 업로드 후 req.file 로 단일 파일 통일
function normalizeSingleFile(req, res, next) {
  const f = req.files || {};
  req.file =
    (f.image && f.image[0]) ||
    (f.slotImage && f.slotImage[0]) ||
    (f.file && f.file[0]) ||
    null;
  next();
}

/**
 * base: /manager/ad  (server.js에서 app.use("/manager/ad", indexmanagerAdRouter))
 */

// 슬롯 1개 조회
router.get("/slot", getSlot);

// 페이지 슬롯 전체 조회
router.get("/slots", listSlots);

// 슬롯 저장(업서트) + 이미지 업로드
router.post("/slot", uploadFields, normalizeSingleFile, upsertSlot);

// 슬롯 삭제
router.delete("/slot", deleteSlot);

// 가게 검색
router.get("/store/search", searchStore);

export default router;
