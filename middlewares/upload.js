// routes/upload.js
import express from "express";
import { upload } from "../middlewares/upload.js";

const router = express.Router();

/**
 * ✅ 범용 업로드 테스트 라우터
 * - server.js에서 app.use("/upload", uploadRouter) 같은 형태로
 *   연결되어 있을 때 안전하게 동작
 *
 * - 폼 필드명이 무엇이든 업로드 테스트 가능
 */
router.post("/", upload.any(), (req, res) => {
  const files = (req.files || []).map((f) => ({
    fieldname: f.fieldname,
    originalname: f.originalname,
    filename: f.filename,
    size: f.size,
    mimetype: f.mimetype,
    url: `/uploads/${f.filename}`, // ✅ public/uploads 기준
  }));

  return res.json({
    ok: true,
    count: files.length,
    files,
  });
});

/**
 * ✅ 헬스 체크
 */
router.get("/health", (_req, res) => {
  res.json({ ok: true, route: "upload" });
});

export default router;
