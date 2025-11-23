// routes/inquiryRouter.js
import express from "express";
import { 
    registerInquiry,
    getInquiryList,
    getInquiryDetail,
    uploadInquiry
} from "../controllers/inquiryController.js";

const router = express.Router();

// POST /api/inquiry/register
router.post("/register", uploadInquiry.single("file"), registerInquiry);

// GET /api/inquiry
router.get("/", getInquiryList);

// GET /api/inquiry/:id
router.get("/:id", getInquiryDetail);

export default router;
