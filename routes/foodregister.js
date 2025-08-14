// routes/foodregister.js
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import * as ctrl from "../controllers/foodregisterController.js";

const router = express.Router();

// ── 경로 계산
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// server.js: app.use("/uploads", express.static(path.join(PUBLIC2, "uploads")))
 // 와 동일한 실제 경로로 맞춥니다.
 const uploadDir = path.join(process.cwd(), "public2", "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

// ── Multer 설정
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path
      .basename(file.originalname, ext)
      .replace(/[^\w.-]+/g, "_");
    cb(null, `${Date.now()}_${base}${ext}`);
  },
});
const upload = multer({ storage });

// name="menuImage[]" 같은 브래킷 표기 허용
const uploadFields = upload.fields([
  { name: "storeImages", maxCount: 10 },
  { name: "menuImage[]", maxCount: 50 },
  { name: "businessCertImage", maxCount: 1 },
]);

// ── 라우트

// 등록
router.post("/", uploadFields, ctrl.createFoodRegister);

// 단건 요약
router.get("/:id(\\d+)", ctrl.getFoodRegisterDetail);

// 풀데이터 (호환 네이밍 지원)
const getFull = ctrl.getFoodRegisterFull ?? ctrl.getFoodStoreFull;
router.get("/:id(\\d+)/full", async (req, res, next) => {
  try {
    if (!getFull) {
      console.error("[foodregister] full handler missing");
      return res.status(500).json({ error: "full handler missing" });
    }
    console.log("[foodregister] using full handler:", getFull.name);
    return await getFull(req, res);
  } catch (e) {
    next(e);
  }
});

export default router;
