import express from "express";
import {
  getShoppingDetail,
  getShoppingList
} from "../controllers/shoppingDetailController.js";

const router = express.Router();

// 쇼핑몰 리스트 조회
router.get("/", getShoppingList);

// 쇼핑몰 상세 조회
router.get("/:id", getShoppingDetail);

export default router;
