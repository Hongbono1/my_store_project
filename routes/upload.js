// routes/uploadRouter.js
import express from "express";
import multer from "multer";
import path from "path";

const router = express.Router();

// ✅ multer 설정
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "public/uploads"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const fileName = `${Date.now()}${ext}`;
    cb(null, fileName);
  },
});
const upload = multer({ storage });

// ✅ 이미지 업로드 처리
router.post("/image", upload.single("image"), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "파일이 없습니다." });

    const imageUrl = `/uploads/${req.file.filename}`;
    res.json({ success: true, url: imageUrl });
  } catch (err) {
    console.error("이미지 업로드 오류:", err);
    res.status(500).json({ success: false, message: "서버 오류" });
  }
});

export default router;
