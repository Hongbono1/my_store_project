import express from "express";
import multer from "multer";
import path from "path";
import { registerDelivery } from "../controllers/deliveryregisterController.js";

const router = express.Router();

const uploadPath = path.join(process.cwd(), "public", "uploads");
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadPath),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
    }
});
const upload = multer({ storage });

router.post(
    "/register",
    upload.fields([
        { name: "profile_image", maxCount: 1 },
        { name: "license_image", maxCount: 1 },
        { name: "insurance_image", maxCount: 1 }
    ]),
    registerDelivery
);

export default router;
