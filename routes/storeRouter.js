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
} from "../controllers/storeController.js";

const router = express.Router();

// 🔽 홍보의 신문 - 각 섹션별 최신 데이터 API
router.get("/food/latest", getFoodLatest);           // 홍보의 배달
router.get("/hot/latest", getHotLatest);             // HOT 랭킹
router.get("/traditional/latest", getTraditionalLatest); // 전통시장
router.get("/festival/latest", getFestivalLatest);   // 공연/축제
router.get("/event/latest", getEventLatest);         // 이벤트
router.get("/open/latest", getOpenLatest);           // 오픈 예정
router.get("/storepride/latest", getPrideLatest);    // 가게 자랑
router.get("/stores/latest", getAllStoresLatest);    // 모든 가게
router.get("/suggest/latest", getSuggestLatest);     // 홍보의 추천
router.get("/season/latest", getSeasonLatest);       // 계절 테마
router.get("/localboard/latest", getLocalBoardLatest); // 지역 게시판

export default router;