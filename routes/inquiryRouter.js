import express from "express";
import {
    uploadInquiry,
    createInquiry,
    getInquiryList,
    getInquiryDetail
} from "../controllers/inquiryController.js";

const router = express.Router();

// health check
router.get("/", (req, res, next) => {
    if (req.query.health === "check") {
        return res.status(200).json({ ok: true, message: "inquiry API alive" });
    }
    next();
});

// multipart + controller 연결
router.post("/", uploadInquiry, createInquiry);

router.get("/", getInquiryList);
router.get("/:id", getInquiryDetail);

export default router;
