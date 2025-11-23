import express from "express";
import { 
    createInquiry,
    getInquiryList,
    getInquiryDetail,
    uploadInquiry      // ✅ Multer 미들웨어 import
} from "../controllers/inquiryController.js";

const router = express.Router();

// POST /api/inquiry - 문의 등록 (이미지 업로드 포함)
router.post("/", uploadInquiry, createInquiry);  // ✅ uploadInquiry 미들웨어 추가

// GET /api/inquiry - 문의 목록 조회
router.get("/", getInquiryList);

// GET /api/inquiry/:id - 문의 상세 조회
router.get("/:id", getInquiryDetail);

export default router;
