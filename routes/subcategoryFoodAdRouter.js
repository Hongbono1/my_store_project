// routes/subcategoryFoodAdRouter.js
import express from "express";
import multer from "multer";

import {
  grid,
  listStores,
  searchStore,
  listCandidates,
  getSlot,
  upsertSlot,
  deleteSlot,
  makeMulterStorage,
  fileFilter,
} from "../controllers/subcategoryFoodAdController.js";

const router = express.Router();

// diskStorage
const storage = multer.diskStorage(makeMulterStorage());
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 },
});

// 어떤 field로 와도 일단 받기(매니저쪽 field명이 바뀌어도 안깨지게)
const uploadAny = upload.any();

function attachFirstFile(req, _res, next) {
  if (!req.file && Array.isArray(req.files) && req.files.length > 0) {
    req.file = req.files[0];
  }
  next();
}

function multerErrorHandler(err, _req, res, next) {
  if (!err) return next();
  return res.status(400).json({
    success: false,
    error: err?.message || "upload_error",
  });
}

// ✅ grid (서브카테고리 페이지가 실제로 쓰는 엔드포인트)
router.get("/grid", grid);

// ✅ 매니저 모달: 가게 목록/검색
router.get("/stores", listStores);
router.get("/search", searchStore);
router.get("/candidates", listCandidates);

// ✅ 매니저 모달: 슬롯 읽기/저장/삭제
router.get("/slot", getSlot);
router.post("/update", uploadAny, attachFirstFile, multerErrorHandler, upsertSlot);
router.delete("/delete", deleteSlot);

export default router;
