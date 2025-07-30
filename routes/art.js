import express from "express";
import multer from "multer";
import path from "path";
import { registerArt, getArtList, getArtById } from "../controllers/artController.js";

const router = express.Router();

// 확장자 포함해서 저장 (중요!)
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, path.join(process.cwd(), "public/uploads/")),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, base + ext);
  }
});
const upload = multer({ storage });

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
