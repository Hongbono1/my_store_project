// routes/ncombinedregister.js
import { Router } from "express";
import multer from "multer";
import path from "path";
import * as ctrl from "../controllers/ncombinedregisterController.js";

const router = Router();
const upload = multer({ dest: path.join(process.cwd(), "uploads") });

// [POST] /combined
router.post(
  "/store",
  upload.fields([
    { name: "storeImages", maxCount: 3 },
    { name: "menuImage[]", maxCount: 200 },
    { name: "businessCertImage", maxCount: 1 },
  ]),
  ctrl.createCombinedStore
);

// [GET] /combined/:id/full
router.get("/:id/full", ctrl.getCombinedStoreFull);

export default router;
