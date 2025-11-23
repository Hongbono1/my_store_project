// routes/inquiryRouter.js
import express from "express";
import { uploadInquiry, createInquiry } from "../controllers/inquiryController.js";

const router = express.Router();

/**
 * POST /api/inquiry
 * - server.js 에서 app.use("/api/inquiry", inquiryRouter); 로 마운트하므로
 *   여기서는 "/" 경로만 사용
 */
router.post(
    "/",
    (req, res, next) => {
        uploadInquiry(req, res, function (err) {
            if (err) {
                console.error("❌ 문의 이미지 업로드 오류:", err);
                return res.status(400).json({
                    ok: false,
                    message: "이미지 업로드 중 오류가 발생했습니다."
                });
            }
            next();
        });
    },
    createInquiry
);

export default router;
