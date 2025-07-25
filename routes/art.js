import express from "express";
import multer from "multer";
import path from "path";
import { registerArt, getArtList, getArtById } from "../controllers/artController.js";

const router = express.Router();

const upload = multer({ dest: path.join(process.cwd(), "public/uploads/") });

router.post(
  "/",
  upload.fields([{ name: "images", maxCount: 3 }]), // input name="images" multiple
  registerArt
);

router.get("/", getArtList);         // 전체 리스트
router.get("/:id", getArtById);      // 상세

export default router;
