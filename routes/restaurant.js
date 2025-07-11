// routes/restaurant.js
import express from "express";
import path from "path";

const router = express.Router();

router.get("/", (req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "restaurant.html"));
});

// 기존 API들
router.get("/:category/stores", ...);

export default router;