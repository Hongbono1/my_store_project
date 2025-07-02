import express from "express";
import { upload } from "../middlewares/upload.js";
import {
  getStores,
  getStoreDetail,
  createStore,
} from "../controllers/storeController.js";

const router = express.Router();

router.get("/",     getStores);
router.get("/:id",  getStoreDetail);
router.post(
  "/",
  upload.fields([
    { name: "images[]" },
    { name: "menuImage[]" },
    { name: "businessCertImage" },
  ]),
  createStore,
);

export default router;
