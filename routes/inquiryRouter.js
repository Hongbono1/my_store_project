import express from "express";
import {
    createInquiry,
    getInquiryList,
    getInquiryDetail
} from "../controllers/inquiryController.js";

const router = express.Router();

// 문의 등록
router.post("/", createInquiry);

// 문의 전체 목록
router.get("/", getInquiryList);

// 문의 상세
router.get("/:id", getInquiryDetail);

export default router;
