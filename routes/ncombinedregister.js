import { Router } from "express";
import multer from "multer";
import path from "path";
import * as ctrl from "../controllers/foodregisterController.js";

const router = Router();

// 파일 업로드 설정 (예: ./uploads)
const upload = multer({ dest: path.join(process.cwd(), "uploads") });

/* ----------------------
 * 저장 (등록 페이지 → DB)
 * ---------------------- */
router.post(
  "/store",
  upload.fields([
    { name: "storeImages", maxCount: 10 },
    { name: "menuImage", maxCount: 50 },
    { name: "businessCertImage", maxCount: 1 },
  ]),
  ctrl.createFoodStore    // ← 컨트롤러 함수 연결
);

/* ----------------------
 * 조회 (상세 페이지 → DB)
 * ---------------------- */
router.get(
  "/foodregister/:id/full",
  ctrl.getFoodStoreFull   // ← 컨트롤러 함수 연결
);

export default router;
