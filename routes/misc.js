import express from "express";
import { verifyBiz, getKakaoKey } from "../controllers/miscController.js";

const router = express.Router();
router.post("/verify-biz", verifyBiz);
router.get ("/kakao-key",  getKakaoKey);
export default router;