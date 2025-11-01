import express from "express";
import { getOpenDetail } from "../controllers/opendetailController.js";
const router = express.Router();

router.get("/:id", getOpenDetail);

export default router;

