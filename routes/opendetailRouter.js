// routes/opendetailRouter.js
import { Router } from "express";
import { getOpenRegisterById } from "../controllers/openregisterController.js";

const router = Router();

// 숫자만 허용
router.get("/:id(\\d+)", getOpenRegisterById);

export default router;


