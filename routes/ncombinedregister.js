import { Router } from "express";
import multer from "multer";
import path from "path";
import { randomUUID } from "crypto";
import * as ctrl from "../controllers/ncombinedregisterController.js";

const router = Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(process.cwd(), "public/uploads")); // 저장 경로
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname); // 원본 확장자 추출 (.jpg, .png)
    const name = randomUUID();                   // 랜덤 파일명
    cb(null, name + ext);                        // 확장자 포함 저장
  },
});

const upload = multer({ storage });

// [POST] /combined
router.post(
  "/store",
  upload.fields([
    { name: "storeImages", maxCount: 3 },
    { name: "menuImage[]", maxCount: 200 },
    { name: "businessCertImage", maxCount: 1 },
  ]),
  ctrl.createCombinedStore
);

// [GET] /combined/:id/full
router.get("/:id/full", ctrl.getCombinedStoreFull);

export default router;
