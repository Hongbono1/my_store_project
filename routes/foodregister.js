// routes/foodregister.js
console.log("[router] foodregister loaded; ctrl keys=", Object.keys(ctrl));
import express from "express";
import multer from "multer";
import path from "path";
import * as ctrl from "../controllers/foodregisterController.js";

const router = express.Router();

// 업로드 저장 경로: public2/uploads (server.js와 일치)
const uploadDir = path.join(process.cwd(), "public2", "uploads");
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^\w.-]+/g, "_");
    cb(null, `${Date.now()}_${base}${ext}`);
  },
});
const upload = multer({ storage });

const uploadFields = upload.fields([
  { name: "storeImages", maxCount: 10 },
  { name: "menuImage[]", maxCount: 50 },
  { name: "businessCertImage", maxCount: 1 },
]);

// 등록
router.post("/", uploadFields, ctrl.createFoodRegister);

// 단건 요약
router.get("/:id", ctrl.getFoodRegisterDetail);

// 풀데이터 (컨트롤러에 둘 중 하나만 있어도 동작)
const getFull = ctrl.getFoodRegisterFull ?? ctrl.getFoodStoreFull;
router.get("/:id/full", async (req, res, next) => {
  try {
    if (!getFull) return res.status(500).json({ error: "full handler missing" });
    return await getFull(req, res);
  } catch (e) {
    next(e);
  }
});

export default router;
