// routes/ncombinedregister.js
import { Router } from "express";
import multer from "multer";
import path from "path";
import * as ctrl from "../controllers/ncombinedregisterController.js";

const router = Router();
const upload = multer({ dest: path.join(process.cwd(), "uploads") });

// Combined Store 등록
router.post(
  "/store",
  upload.fields([
    { name: "storeImages", maxCount: 3 },
    { name: "menuImage[]", maxCount: 200 },
    { name: "businessCertImage", maxCount: 1 },
  ]),
  ctrl.createCombinedStore   // ✅ 이름 맞춤
);

// Combined Store 상세 조회
router.get("/combined/:id/full", ctrl.getCombinedStoreFull); // ✅ 이름/경로 명확히

export default router;
