// routes/inquiryRouter.js
import express from "express";

// 📌 문의 등록(레지스터) 전용 컨트롤러
import { uploadInquiry, createInquiry } from "../controllers/inquiryController.js";

// 📌 문의 상세 보기 전용 컨트롤러
import { getInquiryDetail } from "../controllers/inquiryDetailController.js";

// 📌 문의 게시판(목록) 전용 컨트롤러
import { listInquiryBoard } from "../controllers/inquiryBoardController.js";

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
router.get("/", listInquiryBoard);

/**
 * GET /api/inquiry/:id
 * - 문의 상세
 */
router.get("/:id", getInquiryDetail);

export default router;
