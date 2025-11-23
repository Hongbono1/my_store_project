// routes/inquiryDetailRouter.js
import express from "express";
import { getInquiryDetail } from "../controllers/inquiryDetailController.js";

const router = express.Router();

// ✅ 문의 상세 조회
// GET /api/inquiry/:id
router.get("/:id", getInquiryDetail);

export default router;
