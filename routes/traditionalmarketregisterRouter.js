import express from "express";
import { marketUpload } from "../middlewares/marketUpload.js";
import { createTraditionalMarket } from "../controllers/traditionalmarketregisterController.js";

const router = express.Router();

router.post(
  "/",
  marketUpload.fields([
    { name: "main_img", maxCount: 1 },
    { name: "parking_img", maxCount: 1 },
    { name: "transport_img", maxCount: 1 },
    { name: "customq1_image", maxCount: 1 },
    { name: "customq2_image", maxCount: 1 },
    { name: "customq3_image", maxCount: 1 },
    { name: "customq4_image", maxCount: 1 },
    { name: "customq5_image", maxCount: 1 },
    { name: "customq6_image", maxCount: 1 },
    { name: "customq7_image", maxCount: 1 },
    { name: "customq8_image", maxCount: 1 },
    { name: "q1_image", maxCount: 1 },
    { name: "q2_image", maxCount: 1 },
    { name: "q3_image", maxCount: 1 },
    { name: "q4_image", maxCount: 1 },
    { name: "q5_image", maxCount: 1 },
    { name: "q6_image", maxCount: 1 },
    { name: "q7_image", maxCount: 1 },
    { name: "q8_image", maxCount: 1 },
    { name: "images", maxCount: 30 } // 서브 이미지 여러개
  ]),
  createTraditionalMarket
);

export default router;
