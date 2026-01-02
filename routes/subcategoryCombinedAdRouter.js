// routes/subcategoryCombinedAdRouter.js
import express from "express";
import {
  listStores,
  searchStore,
  listCandidates,
  grid,
  getSlot,
  upsertSlot,
  deleteSlot,
  whereSlots,
} from "../controllers/subcategoryCombinedAdController.js";

const router = express.Router();

// 가게 목록 / 검색 / 후보 목록
router.get("/stores", listStores);
router.get("/search-store", searchStore);
router.get("/candidates", listCandidates);

// 그리드 (all_items + 배너 슬롯)
router.get("/grid", grid);

// 슬롯 읽기 / 저장 / 삭제
router.get("/slot", getSlot);
router.post("/update", upsertSlot);
router.delete("/delete", deleteSlot);

// 특정 가게가 어디 슬롯에 쓰였는지 조회(선택)
router.get("/where-slots", whereSlots);

export default router;
