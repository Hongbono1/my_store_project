import express from "express";
import * as ctrl from "../controllers/suggestController.js";

const router = express.Router();

router.get("/", ctrl.getSuggest);

export default router;
