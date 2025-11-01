// routes/opendetailRouter.js
import express from "express";
import {
    getOpenDetailById,
    getAllOpenDetails
} from "../controllers/opendetailController.js";

const router = express.Router();

// 전체 목록
router.get("/", getAllOpenDetails);

// 단일 상세 조회
router.get("/:id", getOpenDetailById);

export default router;
