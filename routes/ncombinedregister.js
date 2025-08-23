// routes/ncombinedregister.js
import { Router } from "express";
import multer from "multer";
import path from "path";
import * as ctrl from "../controllers/ncombinedregisterController.js";

const router = Router();
const upload = multer({ dest: path.join(process.cwd(), "uploads") });

/* ----------------------
 * 저장 (등록 페이지 → DB)
 * ---------------------- */
router.post(
  "/",
  upload.fields([
    { name: "storeImages", maxCount: 10 },
    { name: "menuImage[]", maxCount: 50 },
    { name: "businessCertImage", maxCount: 1 },
  ]),
  ctrl.createFoodStore
);

/* ----------------------
 * 조회 (상세 페이지 → DB)
 * ---------------------- */
router.get("/:id/full", ctrl.getFoodStoreFull);

export default router;
