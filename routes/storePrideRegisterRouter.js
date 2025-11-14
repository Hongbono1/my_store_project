// routes/storePrideRegisterRouter.js
import express from "express";
import { upload } from "../middlewares/upload.js";
import { createStorePrideRegisterController } from "../controllers/storePrideRegisterController.js";

/**
 * Store Pride Register(우리 가게 자랑) 라우터 팩토리
 */
export function makeStorePrideRegisterRouter(pool) {
    const router = express.Router();
    const ctrl = createStorePrideRegisterController(pool);

    // 등록 (multipart/form-data)
    router.post("/register", upload.any(), ctrl.registerStorePrideRegister);

    // 상세 조회
    router.get("/:id", ctrl.getStorePrideRegisterDetail);

    return router;
}