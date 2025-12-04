// routes/ncategory2managerAdRouter.js
import { Router } from "express";
import multer from "multer";
import path from "path";
import {
  saveImageSlot,
  saveStoreSlot,
  saveTextSlot,
  getSlotsByPage,
} from "../controllers/ncategory2managerAdController.js";

const router = Router();

// =======================
// 📁 Multer 설정 (광고/이미지용)
// =======================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // 기본 업로드 경로: project_root/public/uploads
    cb(null, path.join(process.cwd(), "public", "uploads"));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || "";
    const base = path.basename(file.originalname, ext).replace(/\s+/g, "_");
    const stamp = Date.now();
    cb(null, `${stamp}_${base}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

// =======================
// 📌 라우팅
//  최종 URL (server.js 기준):
//   POST /category/ad/upload
//   POST /category/ad/store
//   POST /category/ad/text/save
//   GET  /category/ad/slots?page=ncategory2manager
// =======================

// 이미지 + 링크 (배너/카드)
router.post("/ad/upload", upload.single("image"), saveImageSlot);

// 등록된 가게 슬롯 (사업자번호 + 상호)
router.post("/ad/store", saveStoreSlot);

// 텍스트 전용 슬롯
router.post("/ad/text/save", saveTextSlot);

// (선택) 특정 page 슬롯 전체 조회
router.get("/ad/slots", getSlotsByPage);

export default router;
