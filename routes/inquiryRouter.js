// routes/inquiryRouter.js
import express from "express";

// 📌 문의 등록(레지스터) 전용 컨트롤러
import { 
    createInquiry,      // ✅ Controller에서 실제 export하는 함수명
    getInquiryList,     // ✅ Controller에서 실제 export하는 함수명
    getInquiryDetail,   // ✅ Controller에서 실제 export하는 함수명
    uploadInquiry       // ✅ Controller에서 실제 export하는 함수명
} from "../controllers/inquiryBoardController.js";

const router = express.Router();

/**
 * POST /api/inquiry
 * - 문의 등록 (이미지 업로드 포함)
 */
router.post("/", uploadInquiry, createInquiry);

/**
 * GET /api/inquiry
 * - 문의 목록 (게시판)
 */
router.get("/", getInquiryList);

/**
 * GET /api/inquiry/:id
 * - 문의 상세
 */
router.get("/:id", getInquiryDetail);

export default router;
