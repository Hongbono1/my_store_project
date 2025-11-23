import express from "express";
import { 
    createInquiry,
    getInquiryList,
    getInquiryDetail 
} from "../controllers/inquiryController.js";

const router = express.Router();

// 🔥 1) Health check 라우트 추가
router.get("/", (req, res, next) => {
    if (req.query.health === "check") {
        return res.status(200).json({ ok: true, message: "inquiry API alive" });
    }
    next();
});

// 🔥 2) 실제 API
router.post("/", createInquiry);
router.get("/", getInquiryList);
router.get("/:id", getInquiryDetail);

export default router;
