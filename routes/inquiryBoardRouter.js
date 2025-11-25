// routes/inquiryBoardRouter.js
import { Router } from "express";
import {
  uploadInquiryBoard,
  createInquiryBoard,
  getInquiryBoardList,
  getInquiryBoardDetail
} from "../controllers/inquiryBoardController.js";

const router = Router();

// 목록
router.get("/", getInquiryBoardList);

// 상세
router.get("/:id", getInquiryBoardDetail);

// 등록 (업로드 + DB 저장)
router.post("/", (req, res, next) => {
  uploadInquiryBoard(req, res, (err) => {
    if (err) {
      return next(err); // LIMIT_UNEXPECTED_FILE 같은 에러 여기서 처리 → 전역 에러핸들러 감
    }
    createInquiryBoard(req, res, next);
  });
});

export default router;
