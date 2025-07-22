// routes/market.js
import express from "express";
import multer from "multer";
import path from "path";
import {
    createMarket,
    getMarketById,
    getAllMarkets
} from "../controllers/marketController.js";

const router = express.Router();

// 업로드 폴더 설정
const upload = multer({ dest: path.join(process.cwd(), "public", "uploads/") });

// 여러 이미지 처리 (main_img, parking_img, transport_img)
const fileFields = [
    { name: "main_img", maxCount: 1 },
    { name: "parking_img", maxCount: 1 },
    { name: "transport_img", maxCount: 1 }
];

// ▣ 전통시장 등록 (POST)
router.post("/", upload.fields(fileFields), createMarket);

// ▣ 전통시장 단건조회 (GET /:id)
router.get("/:id", getMarketById);

// ▣ 전통시장 전체조회 (GET /)
router.get("/", getAllMarkets);

export default router;
