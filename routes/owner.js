// routes/owner.js
import express from "express";
import {
    getOwnerDashboard,
    getOwnerStats,
    getRecentOrders,
    getStoreInfo,
    updateStoreInfo,
    getMenuList,
    addMenu,
    updateMenu,
    deleteMenu,
} from "../controllers/ownerController.js";

const router = express.Router();

// ✅ 대시보드
router.get("/dashboard", getOwnerDashboard);

// ✅ 통계
router.get("/stats", getOwnerStats);

// ✅ 최근 주문
router.get("/orders", getRecentOrders);

// ✅ 가게 정보 조회/수정
router.get("/store", getStoreInfo);
router.post("/store/update", updateStoreInfo);

// ✅ 메뉴 관리
router.get("/menu", getMenuList);
router.post("/menu/add", addMenu);
router.post("/menu/update", updateMenu);
router.delete("/menu/:id", deleteMenu);

// ✅ 반드시 필요
export default router;
