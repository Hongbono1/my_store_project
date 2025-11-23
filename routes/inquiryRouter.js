// routes/inquiryRouter.js

import express from "express";
import {
    uploadInquiry,
    registerInquiry,
    getInquiryList,
    getInquiryDetail
} from "../controllers/inquiryController.js";

const router = express.Router();

// 등록 (파일 포함)
router.post("/register", uploadInquiry.single("file"), registerInquiry);

// 목록
router.get("/list", getInquiryList);

// 상세
router.get("/:id", getInquiryDetail);

export default router;
