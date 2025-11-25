// routes/inquiryBoardRouter.js
import express from "express";
import {
  uploadInquiry,
  createInquiry,
  listInquiry,
} from "../controllers/inquiryController.js";

const router = express.Router();

console.log("✅ inquiryBoardRouter 초기화");

// GET /api/inquiryBoard - 문의 목록
router.get("/", listInquiry);

// GET /api/inquiryBoard/:id - 문의 상세 (나중에 구현)
// router.get("/:id", getInquiryDetail);

// POST /api/inquiryBoard - 문의 등록 (이미지 업로드 + 저장)
router.post("/", uploadInquiry, createInquiry);

console.log("✅ inquiryBoardRouter 라우트 등록 완료");

export default router;
