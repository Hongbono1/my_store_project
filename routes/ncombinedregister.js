import express from "express";
import {
  getCombinedFull,
} from "../controllers/foodregisterController.js";

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(process.cwd(), "public/uploads")); // 저장 경로
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname); // 원본 확장자 추출 (.jpg, .png)
    const name = randomUUID();                   // 랜덤 파일명
    cb(null, name + ext);                        // 확장자 포함 저장
  },
});

const upload = multer({ storage });

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
router.get("/:id/full", getCombinedFull);

export default router;
