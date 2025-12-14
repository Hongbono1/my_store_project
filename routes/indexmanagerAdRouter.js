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

// ✅ multer 설정 (컨트롤러의 makeMulterStorage는 diskStorage 옵션 객체를 반환)
const storage = multer.diskStorage(makeMulterStorage());

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

// ✅ 프론트에서 어떤 키로 보내도 "Unexpected field" 안 뜨게 전부 허용
// (indexmanager.html에서 사용하는 키가 뭔지 몰라도 여기서 흡수)
const slotUpload = upload.fields([
  { name: "image", maxCount: 1 },
  { name: "slotImage", maxCount: 1 },
  { name: "slot_image", maxCount: 1 },
  { name: "adImage", maxCount: 1 },
  { name: "ad_image", maxCount: 1 },
  { name: "banner", maxCount: 1 },
  { name: "bannerImage", maxCount: 1 },
  { name: "banner_image", maxCount: 1 },
  { name: "file", maxCount: 1 },
]);

// ✅ 멀터 에러를 JSON으로 깔끔하게 반환
function multerErrorHandler(err, _req, res, next) {
  if (!err) return next();
  // 대표: "Unexpected field"
  return res.status(400).json({ success: false, error: err.message || "upload error" });
}

// ===== routes =====
router.get("/slot", getSlot);
router.get("/slots", listSlots);
router.get("/slot-items", listSlotItems);

router.post("/slot", (req, res, next) => {
  slotUpload(req, res, (err) => {
    if (err) return multerErrorHandler(err, req, res, next);
    return upsertSlot(req, res);
  });
});

router.delete("/slot", deleteSlot);
router.get("/store/search", searchStore);

export default router;
