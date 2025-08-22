// ncombinedregister.js
import { Router } from "express";
import multer from "multer";
import { createCombinedStore } from "./ncombinedregisterController.js";

const router = Router();

// multer 설정
const upload = multer({ dest: "uploads/" });

// formData + 파일 업로드 처리
router.post("/", upload.any(), createCombinedStore);

export default router;
