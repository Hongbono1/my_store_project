// routes/inquiryRouter.js

import express from "express";
import { 
    createInquiry,
    getInquiryList,
    getInquiryDetail 
} from "../controllers/inquiryController.js";

const router = express.Router();

// POST /api/inquiry - 문의 등록 (단일 엔드포인트)
router.post("/", createInquiry);

// GET /api/inquiry - 문의 목록 조회
router.get("/", getInquiryList);

// GET /api/inquiry/:id - 문의 상세 조회
router.get("/:id", getInquiryDetail);

export default router;
