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

// ✅ 에디터용 이미지 업로드 처리
router.post("/image", upload.single("image"), (req, res) => {
  try {
    console.log("📷 에디터 이미지 업로드 요청:", req.file);
    
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: "파일이 선택되지 않았습니다." 
      });
    }

    const imagePath = `/uploads/${req.file.filename}`;
    console.log("✅ 이미지 업로드 성공:", imagePath);
    
    res.json({ 
      success: true, 
      imagePath: imagePath,
      fileName: req.file.filename 
    });
  } catch (err) {
    console.error("❌ 에디터 이미지 업로드 오류:", err);
    res.status(500).json({ 
      success: false, 
      error: "이미지 업로드 중 서버 오류가 발생했습니다." 
    });
  }
});

// ✅ 기존 이미지 업로드 처리 (호환성 유지)
router.post("/", upload.single("image"), (req, res) => {
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
