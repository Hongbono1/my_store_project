// routes/openregisterRouter.js
import express from "express";
import multer from "multer";
import path from "path";
import {
    createOpenRegister,
    getOpenRegisters,
    getOpenRegisterById,
} from "../controllers/openregisterController.js";

const router = express.Router();

/* =========================================================
   📦 Multer 설정 (대표 이미지 업로드용)
========================================================= */
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, "public2/uploads"),
    filename: (req, file, cb) => {
        const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, unique + path.extname(file.originalname));
    },
});
const upload = multer({ storage });

/* =========================================================
   🟢 오픈예정 등록 (POST /openregister)
========================================================= */
router.post("/", upload.single("img"), createOpenRegister);

/* =========================================================
   🔵 전체 조회 (GET /openregister)
========================================================= */
router.get("/", getOpenRegisters);

/* =========================================================
   🟣 단일 조회 (GET /openregister/:id)
========================================================= */
router.get("/:id", getOpenRegisterById);

export default router;
