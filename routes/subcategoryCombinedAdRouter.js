// routes/subcategoryCombinedAdRouter.js
import express from "express";
import { grid, searchStore } from "../controllers/subcategoryCombinedAdController.js";

const router = express.Router();

router.get("/grid", grid);
router.get("/search-store", searchStore);

export default router;
