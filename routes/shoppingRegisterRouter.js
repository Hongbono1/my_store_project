import express from "express";
import { upload } from "../middlewares/upload.js";
import { registerShopping } from "../controllers/shoppingRegisterController.js";

const router = express.Router();

// 쇼핑몰 등록
router.post("/", upload.fields([
  { name: "image_main", maxCount: 1 },
  { name: "image_banner", maxCount: 3 },
  { name: "image_best", maxCount: 4 }
]), registerShopping);

export default router;
