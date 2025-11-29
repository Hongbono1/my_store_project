// routes/hotplaceRouter.js
import express from "express";
import {
    addHotplaceClick,
    addHotplaceBookmark,
    addHotplaceSearch,
    getTopHotplaces,
} from "../controllers/hotplaceController.js";

const router = express.Router();

// 점수 올리기
router.post("/click", addHotplaceClick);          // POST /api/hotplace/click
router.post("/bookmark", addHotplaceBookmark);    // POST /api/hotplace/bookmark
router.post("/search", addHotplaceSearch);        // POST /api/hotplace/search

// Top4 랭킹
router.get("/top4", getTopHotplaces);             // GET /api/hotplace/top4

export default router;
