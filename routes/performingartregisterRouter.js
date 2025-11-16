import express from "express";
import { performingartUpload } from "../middlewares/performingartUpload.js";
import { registerPerformingArt } from "../controllers/performingartregisterController.js";

const router = express.Router();

// 공연/예술/축제 등록
router.post(
  "/",
  performingartUpload.fields([
    { name: "images", maxCount: 3 },
    { name: "pamphlet", maxCount: 6 },
  ]),
  registerPerformingArt
);

export default router;
