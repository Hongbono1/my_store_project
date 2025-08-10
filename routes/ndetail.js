import { Router } from "express";
import multer from "multer";
import { createStore, getStoreDetail } from "../controllers/storeController.js";

const router = Router();
const upload = multer({ limits: { fileSize: 20 * 1024 * 1024 } });

router.post("/", upload.any(), createStore);
router.get("/:id", getStoreDetail);

export default router;
