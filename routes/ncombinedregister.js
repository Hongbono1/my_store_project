// routes/ncombinedregister.js
import { Router } from "express";
import multer from "multer";
import path from "path";
import * as ctrl from "../controllers/ncombinedregisterController.js";

const router = Router();
const upload = multer({ dest: path.join(process.cwd(), "uploads") });

// ✔ 라우터 로드 확인용 로그
console.log("[router] ncombinedregister loaded");

// ✔ 헬스체크(핑) — 여기 200 나오면 라우터가 제대로 마운트된 것
router.get("/__ping_combined", (_req, res) => res.json({ ok: true }));

// ✔ 등록(통합)
router.post(
  "/combined/store",
  upload.fields([
    { name: "storeImages", maxCount: 3 },
    { name: "menuImage[]", maxCount: 200 },
    { name: "businessCertImage", maxCount: 1 },
  ]),
  ctrl.createCombinedStore
);

// ✔ 상세 조회(통합)
router.get("/combined/:id/full", ctrl.getCombinedStoreFull);

export default router;
