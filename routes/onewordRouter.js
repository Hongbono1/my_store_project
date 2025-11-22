import express from "express";
import {
  getLocalOneword,
  logSearch,
  logMenuClick,
  logView
} from "../controllers/onewordController.js";

const router = express.Router();

// 우리동네 한마디 조회
router.get("/", getLocalOneword);

// 검색 로그 기록
router.post("/log-search", logSearch);

// 메뉴 클릭 로그 기록
router.post("/log-menu", logMenuClick);

// 조회수 로그 기록
router.post("/log-view", logView);

export default router;
