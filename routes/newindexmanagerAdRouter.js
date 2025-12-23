// routes/newindexmanagerAdRouter.js
import express from "express";

import {
  getSlot,
  listSlots,
  listSlotItems,
  upsertSlot,
  deleteSlot,
  searchStore,
} from "../controllers/newindexmanagerAdController.js";

const router = express.Router();

// 상태 확인용
router.get("/ping", (_req, res) => res.json({ success: true, ok: true }));

// 슬롯 조회
router.get("/slot", getSlot);
router.get("/slots", listSlots);
router.get("/slot-items", listSlotItems);

// 슬롯 저장/삭제
router.post("/slot", upsertSlot);
router.delete("/slot", deleteSlot);

// 가게 검색
router.get("/search-store", searchStore);

export default router; // ✅ 이게 없어서 서버가 죽었음(502 원인)
