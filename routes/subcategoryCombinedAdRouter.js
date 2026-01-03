// routes/subcategoryCombinedAdRouter.js
import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import crypto from "crypto";

import {
  listStores,
  searchStore,
  listCandidates,
  grid,
  getSlot,
  upsertSlot,
  deleteSlot,
  whereSlots,
} from "../controllers/subcategoryCombinedAdController.js";

const router = express.Router();

// 업로드 경로 (정책: /data/uploads/manager_ad)
const UPLOAD_SUBDIR = "manager_ad";
const UPLOAD_ABS_DIR = path.join("/data/uploads", UPLOAD_SUBDIR);

function ensureUploadDir() {
  fs.mkdirSync(UPLOAD_ABS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      ensureUploadDir();
      cb(null, UPLOAD_ABS_DIR);
    } catch (e) {
      cb(e);
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
    const name = `${Date.now()}_${crypto.randomBytes(8).toString("hex")}${ext}`;
    cb(null, name);
  },
});

function fileFilter(req, file, cb) {
  const ok = /^image\/(png|jpe?g|webp|gif)$/i.test(file.mimetype || "");
  if (!ok) return cb(new Error("Only image files are allowed"), false);
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

// ✅ multipart/form-data일 때만 multer를 태움
const maybeMultipart = (req, res, next) => {
  const ct = req.headers["content-type"] || "";
  if (ct.includes("multipart/form-data")) {
    // 프론트 field명: image (없어도 req.body 파싱됨)
    return upload.single("image")(req, res, next);
  }
  return next();
};

// 가게 목록 / 검색 / 후보 목록
router.get("/stores", listStores);
router.get("/search", searchStore);        // ✅ /search 엔드포인트 추가
router.get("/search-store", searchStore);
router.get("/candidates", listCandidates);

// 그리드 (all_items + 배너 슬롯)
router.get("/grid", grid);

// 슬롯 읽기 / 저장 / 삭제
router.get("/slot", getSlot);
router.post("/update", maybeMultipart, upsertSlot);
router.delete("/delete", deleteSlot);

// 특정 가게가 어디 슬롯에 쓰였는지 조회(선택)
router.get("/where-slots", whereSlots);

export default router;
