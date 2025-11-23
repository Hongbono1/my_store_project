// controllers/inquiryController.js
import pool from "../db.js";
import multer from "multer";
import path from "path";
import fs from "fs";

// ✅ 문의 업로드 디렉토리 (실제 경로: 프로젝트루트/public/uploads/inquiry)
const uploadDir = "public/uploads/inquiry";

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log("📁 문의 업로드 폴더 생성:", uploadDir);
} else {
    console.log("✅ 문의 업로드 폴더 존재:", uploadDir);
}

// ✅ Multer 스토리지 설정
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        const random = Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        const safeName = `${timestamp}-${random}${ext}`;
        cb(null, safeName);
    }
});

// ✅ 최대 3개 이미지 업로드 (필드명: images)
export const uploadInquiry = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024,  // 5MB
        files: 3
    }
}).array("images", 3);

// ✅ 문의 등록 컨트롤러
export async function createInquiry(req, res) {
    try {
        const {
            writer_name,
            writer_phone,
            writer_email,
            inquiry_type,
            title,
            content
        } = req.body;

        // 필수 값 체크
        if (!writer_name || !inquiry_type || !title || !content) {
            return res.status(400).json({
                ok: false,
                message: "필수 항목이 누락되었습니다. (이름, 문의유형, 제목, 내용)"
            });
        }

        const files = req.files || [];
        const image1_path = files[0] ? `/uploads/inquiry/${files[0].filename}` : null;
        const image2_path = files[1] ? `/uploads/inquiry/${files[1].filename}` : null;
        const image3_path = files[2] ? `/uploads/inquiry/${files[2].filename}` : null;

        const sql = `
      INSERT INTO inquiry (
        writer_name,
        writer_phone,
        writer_email,
        inquiry_type,
        title,
        content,
        image1_path,
        image2_path,
        image3_path
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING id, created_at
    `;

        const params = [
            writer_name,
            writer_phone || null,
            writer_email || null,
            inquiry_type,
            title,
            content,
            image1_path,
            image2_path,
            image3_path
        ];

        const result = await pool.query(sql, params);
        const newInquiry = result.rows[0];

        return res.status(201).json({
            ok: true,
            message: "문의가 정상적으로 등록되었습니다.",
            inquiryId: newInquiry.id,
            created_at: newInquiry.created_at
        });
    } catch (err) {
        console.error("❌ createInquiry ERROR:", err);
        return res.status(500).json({
            ok: false,
            message: "문의 등록 중 오류가 발생했습니다."
        });
    }
}
