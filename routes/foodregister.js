// routes/foodregister.js
import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import {
  createFoodStore,
  getFoodStoreById,
  getFoodRegisterFull,
  updateFoodStore, 
} from "../controllers/foodregisterController.js";

const router = Router();

/* -------------------------------------------------------
 * 업로드 설정 (선택 사항)
 * - 파일이 없어도 동작하도록 구성
 * - 저장 위치: ./uploads  (없으면 생성)
 * ----------------------------------------------------- */
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ts = Date.now();
    const safeName = (file.originalname || "file").replace(/\s+/g, "_");
    cb(null, `${ts}_${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 10 }, // 10MB, 최대 10개
});

/* -------------------------------------------------------
 * 공통: :id 파라미터 가드
 * - bigint 변환 오류(22P02) 예방
 * ----------------------------------------------------- */

router.put("/:id", upload.array("storeImages", 10), updateFoodStore);
router.param("id", (req, res, next, id) => {
  const n = Number.parseInt(id, 10);
  if (!Number.isSafeInteger(n)) {
    return res.status(400).json({ ok: false, error: "Invalid id" });
  }
  // 컨트롤러에서 필요시 req.storeId 사용 가능
  req.storeId = n;
  next();
});

/* -------------------------------------------------------
 * 등록 (multipart/form-data)
 * - 프론트에서 FormData로 보낸 필드 + 이미지 수신
 * - 이미지 필드명: storeImages[*]
 *   (필드명이 다르면 .any()로 바꿔 사용 가능)
 * ----------------------------------------------------- */
router.post("/", upload.array("storeImages", 10), createFoodStore);

/* -------------------------------------------------------
 * 상세 조회
 * ----------------------------------------------------- */
router.get("/:id", getFoodStoreById);

/* -------------------------------------------------------
 * 풀 상세 조회 (가게 + 이미지 + 메뉴)
 * - ndetail.html이 호출하는 엔드포인트
 * ----------------------------------------------------- */
router.get("/:id/full", getFoodRegisterFull);

export default router;
