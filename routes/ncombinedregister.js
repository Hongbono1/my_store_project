// routes/ncombinedregister.js
import { Router } from "express";
import multer from "multer";
import path from "path";
import * as ctrl from "../controllers/ncombinedregisterController.js";

const router = Router();
const upload = multer({ dest: path.join(process.cwd(), "uploads") });

// 프론트가 POST "/store" 로 요청하므로 라우터 경로도 "/store"
router.post(
  "/store",
  upload.fields([
    { name: "storeImages", maxCount: 10 },
    { name: "menuImage[]", maxCount: 200 },   // ★ 프론트 name과 정확히 일치(대괄호 포함)
    { name: "businessCertImage", maxCount: 1 },
  ]),
  ctrl.createFoodStore
);

// 상세는 "/foodregister/:id/full" 그대로
router.get("/foodregister/:id/full", ctrl.getFoodStoreFull);

export default router;
