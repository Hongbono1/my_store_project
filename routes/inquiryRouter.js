import express from "express";
import { 
    createInquiry,
    getInquiryList,
    getInquiryDetail,
    uploadInquiry
} from "../controllers/inquiryController.js";

const router = express.Router();

/* ------------------------------
   1) Health check
-------------------------------- */
router.get("/", async (req, res, next) => {
    if (req.query.health === "check") {
        return res.status(200).json({
            ok: true,
            message: "inquiry API alive"
        });
    }
    next(); // 목록 조회로 계속 진행
});

/* ------------------------------
   2) 문의 등록 (multipart/form-data + 이미지 3개)
      반드시 multer 미들웨어 먼저!
-------------------------------- */
router.post("/", uploadInquiry, createInquiry);

/* ------------------------------
   3) 문의 목록 조회
-------------------------------- */
router.get("/", getInquiryList);

/* ------------------------------
   4) 문의 상세 조회
-------------------------------- */
router.get("/:id", getInquiryDetail);

export default router;
