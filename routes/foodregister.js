// routes/foodregister.js
import { Router } from "express";
import multer from "multer";
import { createFoodStore, getFoodStoreById } from "../controllers/foodregisterController.js";

const router = Router();

/**
 * 업로드는 “있어도” 동작하도록 최소 처리(파일 저장은 추후 확장).
 * 프론트에서 FormData에 파일이 포함돼도 여기선 무시/통과 가능.
 */
const upload = multer({ storage: multer.memoryStorage() });

// 등록 (multipart/form-data 수신)
router.post("/", upload.any(), createFoodStore);

// 상세 조회
router.get("/:id", getFoodStoreById);

export default router;
