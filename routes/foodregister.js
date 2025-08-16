// routes/foodregister.js
import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import * as ctrl from "../controllers/foodregisterController.js";

const router = Router();

/* -------------------------------------------------------
 * 업로드 저장소 설정
 * - 저장 경로: ./uploads (없으면 생성)
 * - 파일명: <timestamp>_<원본파일명 공백→_>
 * ----------------------------------------------------- */
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ts = Date.now();
    const safe = (file.originalname || "file").replace(/\s+/g, "_");
    cb(null, `${ts}_${safe}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 파일당 10MB
    files: 10,                  // 최대 10개
  },
});

/* -------------------------------------------------------
 * 공통: :id 파라미터 가드 (모든 /:id 라우트에서 실행)
 * ----------------------------------------------------- */
router.param("id", (req, res, next, id) => {
  const n = Number.parseInt(id, 10);
  if (!Number.isSafeInteger(n)) {
    return res.status(400).json({ ok: false, error: "Invalid id" });
  }
  req.storeId = n; // 필요하면 컨트롤러에서 사용
  next();
});

/* -------------------------------------------------------
 * 등록 (multipart/form-data)
 * - 필드: businessName, roadAddress, phone(선택)
 * - 이미지: storeImages[*]
 * - 메뉴: storeMenus[i][j][category|name|price]
 * ----------------------------------------------------- */
router.post("/", upload.array("storeImages", 10), ctrl.createFoodStore);
router.get("/:id", ctrl.getFoodStoreById);
router.get("/:id/full", ctrl.getFoodRegisterFull);
router.put("/:id", upload.array("storeImages", 10), ctrl.updateFoodStore);
router.post("/:id/menu", upload.none(), ctrl.createMenuItem)

export default router;
