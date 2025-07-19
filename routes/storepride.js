import express from "express";
import { insertStorePride, getStorePrideById } from "../controllers/storeprideController.js";
const router = express.Router();

router.post("/register", insertStorePride);
app.use("/api/storepride", storeprideRouter);

export default router;
