import express from "express";
import { getBestPickStores } from "../controllers/bestpickController.js";

const router = express.Router();

router.get("/", getBestPickStores);

export default router;
