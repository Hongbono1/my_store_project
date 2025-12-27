// routes/ncombinedregister.js
import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import * as ctrl from "../controllers/ncombinedregisterController.js";

const router = Router();

// ✅ server.js와 동일 정책: prod=/data/uploads, dev=public2/uploads
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProduction = (process.env.NODE_ENV || "").toLowerCase() === "production";
const UPLOAD_ROOT = isProduction
  ? "/data/uploads"
  : path.join(__dirname, "..", "public2", "uploads");

// 폴더 없으면 생성
if (!fs.existsSync(UPLOAD_ROOT)) {
  fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_ROOT);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${randomUUID()}${ext}`);
  },
});

// 필요하면 limits 추가 가능
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

// [POST] /combined/store
router.post(
  "/store",
  upload.fields([
    // ✅ storeImages / storeImages[] 둘 다 허용 (Unexpected field 방지)
    { name: "storeImages", maxCount: 3 },
    { name: "storeImages[]", maxCount: 3 },

    // ✅ menuImage[] / menuImage 둘 다 허용
    { name: "menuImage[]", maxCount: 200 },
    { name: "menuImage", maxCount: 200 },

    { name: "businessCertImage", maxCount: 1 },
  ]),
  ctrl.createCombinedStore
);

// [GET] /combined/:id/full
router.get("/:id/full", ctrl.getCombinedStoreFull);

// [GET] /combined/biz/:businessNumber/full - 사업자번호로 조회
router.get("/biz/:businessNumber/full", ctrl.getCombinedStoreByBusinessNumber);

export default router;
