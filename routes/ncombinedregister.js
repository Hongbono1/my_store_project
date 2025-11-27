// routes/ncombinedregister.js
import express from "express";
import { getCombinedFull } from "../controllers/foodregisterController.js";

const router = express.Router();

/* ============================
   GET /combined/:id/full
   (ndetail.html에서 호출)
=============================== */
router.get("/:id/full", getCombinedFull);

export default router;
