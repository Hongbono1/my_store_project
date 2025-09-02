import { Router } from "express";
import multer from "multer";
import path from "path";
import * as ctrl from "../controllers/ncombinedregisterController.js";

const router = Router();
const upload = multer({ dest: path.join(process.cwd(), "uploads") });

// 통합 등록(POST)
router.post(
  "/combined/store",
  upload.fields([
    { name: "storeImages", maxCount: 3 },
    { name: "menuImage[]", maxCount: 200 },
    { name: "businessCertImage", maxCount: 1 },
  ]),
  ctrl.createCombinedStore
);

// 통합 상세(GET)
router.get("/combined/:id/full", ctrl.getCombinedStoreFull);

// 라우터 살아있는지 핑(점검용)
router.get("/__ping_combined", (_req, res) => res.json({ ok: true }));

export default router;
