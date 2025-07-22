import express from "express";
import multer from "multer";
import path from "path";
import { createSubmarket, getSubmarketById, getSubmarketList } from "../controllers/submarketController.js";

const router = express.Router();
const upload = multer({ dest: path.join(process.cwd(), "public", "uploads/") });

// 등록
router.post("/register", upload.fields([
    { name: "main_img", maxCount: 1 },
    { name: "parking_img", maxCount: 1 },
    { name: "transport_img", maxCount: 1 }
]), createSubmarket);

// 목록
router.get("/", getSubmarketList);

// 상세
router.get("/:id", getSubmarketById);

export default router;
