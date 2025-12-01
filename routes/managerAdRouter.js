// routes/managerAdRouter.js
import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { uploadManagerAd } from "../controllers/managerAdController.js";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 업로드 폴더
const storage = multer.diskStorage({
    destination(req, file, cb) {
        cb(null, path.join(__dirname, "../public/uploads/manager_ads"));
    },
    filename(req, file, cb) {
        const ext = path.extname(file.originalname);
        const name = Date.now() + "_" + Math.random().toString(36).substring(2);
        cb(null, `${name}${ext}`);
    }
});

const upload = multer({ storage });

// ==============================
// 📌 광고 업로드 (manager)
// ==============================
router.post(
    "/upload",
    upload.single("image"),
    uploadManagerAd
);

export default router;
