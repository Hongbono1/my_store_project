// routes/inquiryBoardRouter.js
import express from "express";
import { listInquiryBoard } from "../controllers/inquiryBoardController.js";

const router = express.Router();

// 문의 목록 조회 - 게시판 전용
// GET /api/inquiry-board
router.get("/", listInquiryBoard);

export default router;
