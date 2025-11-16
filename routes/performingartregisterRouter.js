import express from "express";
import { performingartUpload } from "../middlewares/performingartUpload.js";
import { registerPerformingArt } from "../controllers/performingartregisterController.js";
import { getPerformingArtById } from "../controllers/performingartdetailController.js";

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

// 공연/예술 상세 조회
router.get("/:id", getPerformingArtById);

export default router;
