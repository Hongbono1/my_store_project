// controllers/inquiryController.js
import pool from "../db.js";
import multer from "multer";
import path from "path";
import fs from "fs";

// ✅ 업로드 디렉토리: /public/uploads/inquiry
const uploadDir = path.join(process.cwd(), "public", "uploads", "inquiry");

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log("📁 문의 업로드 폴더 생성:", uploadDir);
} else {
    console.log("✅ 문의 업로드 폴더 존재:", uploadDir);
}

// ✅ Multer 설정 (이미지 최대 3장, 5MB)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        const random = Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname || "");
        const base = path.basename(file.originalname || "inquiry", ext) || "inquiry";
        const safeBase = base.replace(/[^\w가-힣_-]/g, "");
        const unique = `${timestamp}-${random}-${safeBase}`;
        cb(null, unique + ext.toLowerCase());
    },
});

const upload = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
        files: 3,
    },
});

// ✅ Multer 설정 변경: array() 사용
export const uploadInquiry = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
        files: 3,
    },
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|gif|webp/;
        const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
        const mimeOk = allowed.test(file.mimetype);
        
        if (extOk && mimeOk) {
            cb(null, true);
        } else {
            cb(new Error("이미지 파일만 업로드 가능합니다."));
        }
    }
}).array("images", 3);  // ✅ name="images"로 통일

// --------------------------------------------------------
// 문의 생성
// --------------------------------------------------------
export async function createInquiry(req, res, next) {
    try {
        const {
            inquiry_type,
            title,
            content,
            writer_name,
            writer_phone,
            writer_email,
            is_secret,
        } = req.body || {};

        // 서버에서도 필수값 체크
        if (!title || !content) {
            return res.status(400).json({
                ok: false,
                message: "제목과 내용은 필수입니다.",
            });
        }

        // 연락처 하나도 없으면 막기 (선택)
        if (!writer_name && !writer_phone && !writer_email) {
            return res.status(400).json({
                ok: false,
                message: "이름/전화/이메일 중 최소 1개는 입력해 주세요.",
            });
        }

        // ✅ array()로 받은 파일들 처리
        const files = Array.isArray(req.files) ? req.files.slice(0, 3) : [];
        const fileNames = files.map(f => `/uploads/inquiry/${f.filename}`);
        
        // 3개 맞추기 (부족하면 null 채움)
        while (fileNames.length < 3) {
            fileNames.push(null);
        }

        const [image1_path, image2_path, image3_path] = fileNames;

        console.log("📁 업로드된 파일:", { image1_path, image2_path, image3_path });

        // 🔥 inquiry.user_name 이 NOT NULL 이라서
        // writer_name 값을 그대로 user_name, writer_phone 를 user_phone 으로 복사
        const user_name = writer_name || null;
        const user_phone = writer_phone || null;

        const sql = `
      INSERT INTO inquiry (
        title,
        content,
        user_name,
        user_phone,
        inquiry_type,
        writer_name,
        writer_phone,
        writer_email,
        image1_path,
        image2_path,
        image3_path,
        created_at,
        updated_at
      ) VALUES (
        $1, $2,
        $3, $4,
        $5,
        $6, $7, $8,
        $9, $10, $11,
        NOW(), NOW()
      )
      RETURNING id
    `;

        const params = [
            title,
            content,
            user_name,
            user_phone,
            inquiry_type || null,
            writer_name || null,
            writer_phone || null,
            writer_email || null,
            image1_path,
            image2_path,
            image3_path,
        ];

        const result = await pool.query(sql, params);
        const newId = result.rows[0]?.id;

        console.log("✅ 문의 등록 완료:", {
            id: newId,
            inquiry_type,
            title,
            user_name,
            uploaded_files: files.length
        });

        return res.status(201).json({
            ok: true,
            id: newId,
            message: "문의가 정상적으로 등록되었습니다.",
            uploaded_files: files.length
        });
    } catch (err) {
        console.error("❌ createInquiry ERROR:", err);
        if (!res.headersSent) {
            return res.status(500).json({
                ok: false,
                message: "문의 저장 중 오류가 발생했습니다.",
                error: err.message,
            });
        }
        return next(err);
    }
}

// (옵션) 관리자용 목록 조회
export async function listInquiry(req, res, next) {
    try {
        const result = await pool.query(
            `
      SELECT
        id,
        inquiry_type,
        title,
        user_name,
        writer_name,
        writer_phone,
        writer_email,
        created_at
      FROM inquiry
      ORDER BY created_at DESC
      LIMIT 50
      `
        );

        return res.json({
            ok: true,
            items: result.rows,
        });
    } catch (err) {
        console.error("❌ listInquiry ERROR:", err);
        return next(err);
    }
}
