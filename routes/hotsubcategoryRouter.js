// routes/hotsubcategoryRouter.js
import express from "express";
import * as ctrl from "../controllers/hotsubcategoryController.js"; // ✅ 추가: 컨트롤러 연결
const router = express.Router();

// 핫 서브카테고리(테마) 전용 API
router.get("/sub/theme", ctrl.getHotSubTheme);

// (선택) 목록과 단일 조회 추가 예시
router.get("/", async (req, res) => res.json({ ok: true, note: "hotsubcategory root" }));

export default router;
