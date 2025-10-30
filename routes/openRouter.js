// routes/openRouter.js
import express from "express";
import { getOpenList, getOpenById } from "../controllers/openController.js";

const router = express.Router();

/* =========================================================
   🔵 전체 조회 (GET /open)
========================================================= */
router.get("/", getOpenList);

/* =========================================================
   🟣 단일 조회 (GET /open/:id)
========================================================= */
router.get("/:id", getOpenById);

export default router;
