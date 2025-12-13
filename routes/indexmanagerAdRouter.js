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

// ✅ multer (단일 이미지 업로드)
const upload = multer({
  storage: multer.diskStorage(makeMulterStorage()),
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

// ✅ 슬롯 조회/목록
router.get("/slot", getSlot);
router.get("/slots", listSlots);

// ✅ 슬롯 저장(업서트) - input name: image 권장
// (프론트에서 slotImage/file로 보낼 수도 있어서 fields로 다 받음)
router.post(
  "/slot",
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "slotImage", maxCount: 1 },
    { name: "file", maxCount: 1 },
  ]),
  (req, res, next) => {
    // fields 사용 시 파일은 req.files에 들어가므로 req.file로 합쳐줌
    const f =
      (req.files?.image && req.files.image[0]) ||
      (req.files?.slotImage && req.files.slotImage[0]) ||
      (req.files?.file && req.files.file[0]) ||
      null;

    req.file = f;
    next();
  },
  upsertSlot
);

// ✅ 슬롯 삭제
router.delete("/slot", deleteSlot);

// ✅ 가게 검색 (사업자번호/키워드)
router.get("/store/search", searchStore);

export default router;
