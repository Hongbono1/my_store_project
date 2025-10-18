import express from "express";
import { getSuggestionsByMood } from "../controllers/suggestController.js";

const router = express.Router();
router.get("/", getSuggestionsByMood);

export default router;
