// routes/categoryAdRouter.js
import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";

import {
  uploadManagerAd,
  saveTextSlot,
  getSlot,
  getTextSlot,
  getFoodCategories,
  createFoodCategory,
  deleteFoodCategory,
  assignStoreToSlot,
  searchStoreByBusiness,
} from "../controllers/categoryAdController.js";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🔹 업로드 폴더: public/uploads/manager_ad (카테고리도 여기 재사용)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "..", "public", "uploads", "manager_ad"));
  },
  filename: (req, file, cb) => {
    const ts = Date.now();
    const rnd = Math.random().toString(36).slice(2, 8);
    const ext = path.extname(file.originalname) || "";
    cb(null, `${ts}_${rnd}${ext}`);
  },
});

const upload = multer({ storage });

/**
 * 공통 유틸: page 기본값을 food_category로 강제
 * (혹시 프론트에서 안 보냈을 때를 대비)
 */
function ensureFoodCategory(req) {
  if (!req.body) req.body = {};
  if (!req.body.page) {
    req.body.page = "food_category";
  }
}

function ensureFoodCategoryQuery(req) {
  if (!req.query) req.query = {};
  if (!req.query.page) {
    req.query.page = "food_category";
  }
}

// 🔵 카테고리용 배너/이미지 업로드
router.post(
  "/category-manager/ad/upload",
  upload.single("image"),
  (req, res, next) => {
    ensureFoodCategory(req);
    uploadManagerAd(req, res, next);
  }
);

// 🟢 카테고리용 텍스트 저장
router.post(
  "/category-manager/ad/text/save",
  express.json(),
  (req, res, next) => {
    ensureFoodCategory(req);
    saveTextSlot(req, res, next);
  }
);

// (옵션) 카테고리용 슬롯 조회
router.get("/category-manager/ad/slot", (req, res, next) => {
  ensureFoodCategoryQuery(req);
  getSlot(req, res, next);
});

router.get("/category-manager/ad/text", (req, res, next) => {
  ensureFoodCategoryQuery(req);
  getTextSlot(req, res, next);
});

// 삭제
router.delete("/api/food-categories/:id", deleteFoodCategory);

// ===============================
// 🍱 FOOD CATEGORY API
// ===============================

// 목록 조회
router.get("/api/food-categories", getFoodCategories);

// 추가
router.post("/api/food-categories", express.json(), createFoodCategory);

// ===============================
// 🏪 가게 연결 API
// ===============================

// 사업자번호 + 상호로 가게를 슬롯에 연결
router.post("/api/assign-store", express.json(), assignStoreToSlot);

// 사업자번호로 가게 검색 (자동완성)
router.get("/api/search-store", searchStoreByBusiness);

export default router;
