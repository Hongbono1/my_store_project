import express from "express";
import {
    getFoodLatest,
    getHotLatest,
    getTraditionalLatest,
    getFestivalLatest,
    getEventLatest,
    getOpenLatest,
    getPrideLatest,
    getAllStoresLatest,
    getSuggestLatest,
    getSeasonLatest,
    getLocalBoardLatest,
} from "../controllers/newspaperController.js";

const router = express.Router();

// 🔽 각 섹션별 최신 데이터 API
router.get("/food/latest", getFoodLatest);
router.get("/hot/latest", getHotLatest);
router.get("/traditional/latest", getTraditionalLatest);
router.get("/festival/latest", getFestivalLatest);
router.get("/event/latest", getEventLatest);
router.get("/open/latest", getOpenLatest);
router.get("/storepride/latest", getPrideLatest);
router.get("/stores/latest", getAllStoresLatest);
router.get("/suggest/latest", getSuggestLatest);
router.get("/season/latest", getSeasonLatest);
router.get("/localboard/latest", getLocalBoardLatest);

export default router;