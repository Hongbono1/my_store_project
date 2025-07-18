// routes/storepride.js (수정)
import express from "express";
import { insertStorePride, getStorePrideById } from "../controllers/storeprideController.js";

const router = express.Router();

router.post('/register', insertStorePride);
router.get('/:id', getStorePrideById);

export default router;
