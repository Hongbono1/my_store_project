// routes/inquiryBoardRouter.js
import express from "express";
import {
  uploadInquiryBoard,
  createInquiryBoard,
  getInquiryBoardList,
  getInquiryBoardDetail,
} from "../controllers/inquiryBoardController.js";

const router = express.Router();

// 🏥 Health Check: GET /api/inquiryBoard?health=check
router.get("/", (req, res, next) => {
  if (req.query.health === "check") {
    return res.status(200).json({
      ok: true,
      message: "inquiryBoard API alive",
    });
  }
  return next();
});

// 📨 문의 등록 (이미지 업로드 포함)
router.post("/", uploadInquiryBoard, createInquiryBoard);

// 📋 문의 목록
router.get("/", getInquiryBoardList);

// 📄 문의 상세
router.get("/:id", getInquiryBoardDetail);

export default router;
