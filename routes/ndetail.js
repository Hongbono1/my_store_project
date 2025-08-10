// routes/store.js
import { Router } from "express";
import multer from "multer";
import { createStore, getStoreDetail } from "../controllers/storeController.js";

const router = Router();
const upload = multer({ limits: { fileSize: 20 * 1024 * 1024 } });

// 파일도 올릴 수 있으면
router.post("/", upload.any(), createStore);

// 조회
router.get("/:id", getStoreDetail);

export default router;
