// routes/storeprideRouter.js
import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createStorePrideController } from "../controllers/storeprideController.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 업로드 폴더 보장: public/uploads
const uploadDir = path.join(__dirname, "..", "public", "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
        const ts = Date.now();
        const safe = (file.originalname || "file").replace(/[^\w.\-]+/g, "_");
        cb(null, `${ts}_${safe}`);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024, files: 20 }, // 파일당 10MB, 최대 20개
    fileFilter: (_req, file, cb) => {
        // 이미지 파일만
        if (!file.mimetype.startsWith("image/")) {
            return cb(new Error("이미지 파일만 업로드 가능합니다."));
        }
        cb(null, true);
    },
});

/**
 * 라우터 팩토리: pool 주입
 * @param {import('pg').Pool} pool
 */
export function makeStorePrideRouter(pool) {
    const router = express.Router();
    const ctrl = createStorePrideController(pool);

    // 등록 (모든 파일 필드 허용: main_img, q1_image.., customq*_image 등)
    router.post(
        "/register",
        upload.any(), // 폼에서 name이 많은 구조라 any() 사용
        ctrl.registerStorePride
    );

    // 상세 조회
    router.get("/:id", ctrl.getStorePrideDetail);

    return router;
}
