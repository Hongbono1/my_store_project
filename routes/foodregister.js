// routes/foodregister.js
import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import * as ctrl from "../controllers/foodregisterController.js";
const router = Router();

/* =========================================
 * 업로드 저장소 (./uploads) 보장
 * =======================================*/
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

/* =========================================
 * multer 설정
 *  - 저장소: ./uploads
 *  - 파일명: <timestamp>_<원본파일명(공백→_)>
 *  - 용량: 파일당 20MB
 *  - 총 개수: 50개(여유)
 * =======================================*/
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
    fileSize: 20 * 1024 * 1024, // 파일당 20MB
    files: 200,                  // 총 파일 수 상향
    fields: 2000,                // 텍스트 필드 수
    fieldNameSize: 200,
  },
});

/* 예상 필드만 엄격히 허용 */
const acceptKnown = upload.fields([
  { name: "storeImages", maxCount: 50 },
  { name: "businessCertImage", maxCount: 1 },
  { name: "menuImage[]", maxCount: 150 }, // 구형 폼 호환
  { name: "menuImage", maxCount: 150 },  // 단수 이름도 허용
]);

/* 어떤 필드든 허용(예상 밖 필드 들어올 때 사용) */
const acceptAnyFiles = upload.any();

/* 하이브리드: 예상치 못한 필드가 들어오면 자동으로 any()로 폴백 */
function acceptWithFallback(req, res, next) {
  acceptKnown(req, res, (err) => {
    if (err) {
      console.warn("[multer] acceptKnown error:", err.code || err.message);
    }
    if (err && err.code === "LIMIT_UNEXPECTED_FILE") {
      return acceptAnyFiles(req, res, next);
    }
    if (err) return next(err);
    next();
  });
}

/* =========================================
 * :id 파라미터 가드 (정수 아닌 경우 400)
 *  - DB가 bigint를 기대하는 상황(22P02 방지)
 * =======================================*/
router.param("id", (req, res, next, id) => {
  const n = Number.parseInt(String(id), 10);
  if (!Number.isSafeInteger(n)) {
    return res.status(400).json({ ok: false, error: "Invalid id" });
  }
  req.storeId = n;
  next();
});

/* =========================================
 * 라우트
 *  - POST   /foodregister        등록
 *  - GET    /foodregister/:id    단건조회
 *  - GET    /foodregister/:id/full  상세(메뉴 포함)
 *  - PUT    /foodregister/:id    수정
 * =======================================*/
router.post("/", acceptWithFallback, ctrl.createFoodStore);
router.get("/:id", ctrl.getFoodStoreById);
router.get("/:id/full", ctrl.getFoodRegisterFull);
router.put("/:id", acceptWithFallback, ctrl.updateFoodStore);

export default router;
