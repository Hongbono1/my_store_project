import express from "express";
import multer from "multer";
import path from "path";
import { registerArt, getArtList, getArtById } from "../controllers/artController.js";

const router = express.Router();
const upload = multer({ dest: path.join(process.cwd(), "public/uploads/") });

router.post(
  "/",
  upload.fields([
    { name: "images", maxCount: 3 },
    { name: "pamphlet", maxCount: 6 }
  ]),
  registerArt
);
router.get("/", getArtList);
router.get("/:id", getArtById);

export default router;
