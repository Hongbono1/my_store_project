// routes/foodregister.js
import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import * as ctrl from "../controllers/foodregisterController.js";

const router = Router();

/* ⬇️ 추가: 업로드 받을 필드 정의 */
const storeImageFields = [{ name: "storeImages[]", maxCount: 10 }];
const menuImageFields = [{ name: "menuImage[]", maxCount: 20 }];

/* 업로드 저장소 보장 */
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

/* multer 설정 */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    // ✅ 한글/특수문자/공백 상관없이 항상 ASCII 안전 파일명으로 저장
    const ext = (path.extname(file?.originalname || "") || ".jpg").toLowerCase();
    const base = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    cb(null, `${base}${ext}`); // 예: 1755222499699_abc123.jpg
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024, files: 50 },
});

/* Routes */
router.post(
  "/",
  upload.fields([...storeImageFields, ...menuImageFields]),
  ctrl.createFoodStore
);

router.get("/:id", ctrl.getFoodStoreById);
router.get("/:id/full", ctrl.getFoodRegisterFull);
router.put(
  "/:id",
  upload.fields([...storeImageFields, ...menuImageFields]),
  ctrl.updateFoodStore
);

export default router;
