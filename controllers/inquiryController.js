// controllers/inquiryController.js
import pool from "../db.js";
import multer from "multer";
import path from "path";
import fs from "fs";

// ✅ 업로드 디렉토리: /public/uploads/inquiry (브라우저에서 /uploads/… 로 접근)
const uploadDir = path.join(process.cwd(), "public", "uploads", "inquiry");

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log("📁 문의 업로드 폴더 생성:", uploadDir);
} else {
    console.log("✅ 문의 업로드 폴더 존재:", uploadDir);
}

// ✅ Multer 설정
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

// ✅ 이미지 최대 3장, 5MB 제한
const upload = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
        files: 3,
    },
});

// ✅ 라우터에서 쓸 미들웨어
export const uploadInquiry = upload.array("images", 3);

// --------------------------------------------------------
// 문의 생성
// --------------------------------------------------------
export async function createInquiry(req, res, next) {
    try {
        // 1) 기본 필드 읽기
        const {
            inquiry_type,
            title,
            content,
            writer_name,
            writer_phone,
            writer_email,
        } = req.body || {};

        // 2) 서버 측에서도 필수값 한 번 더 체크
        if (!inquiry_type || !title || !content) {
            return res.status(400).json({
                ok: false,
                message: "문의 유형, 제목, 내용은 필수입니다.",
            });
        }

        if (!writer_name && !writer_phone && !writer_email) {
            return res.status(400).json({
                ok: false,
                message: "연락 가능한 정보(이름/전화/이메일) 중 최소 1개는 입력해 주세요.",
            });
        }

        // 3) 파일 경로 정리 (최대 3장)
        const files = Array.isArray(req.files) ? req.files.slice(0, 3) : [];
        const imagePaths = files.map((f) => {
            // 브라우저에서 접근할 경로: /uploads/inquiry/파일명
            return `/uploads/inquiry/${f.filename}`;
        });

        // image1~3 채우기
        const image1 = imagePaths[0] || null;
        const image2 = imagePaths[1] || null;
        const image3 = imagePaths[2] || null;

        // 4) DB INSERT
        const sql = `
      INSERT INTO inquiry (
        inquiry_type,
        title,
        content,
        writer_name,
        writer_phone,
        writer_email,
        image1,
        image2,
        image3,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3,
        $4, $5, $6,
        $7, $8, $9,
        NOW(), NOW()
      )
      RETURNING id
    `;

        const params = [
            inquiry_type,
            title,
            content,
            writer_name || null,
            writer_phone || null,
            writer_email || null,
            image1,
            image2,
            image3,
        ];

        const result = await pool.query(sql, params);
        const newId = result.rows[0]?.id;

        console.log("✅ 문의 등록 완료:", {
            id: newId,
            inquiry_type,
            title,
            writer_name,
        });

        return res.status(201).json({
            ok: true,
            id: newId,
            message: "문의가 정상적으로 등록되었습니다.",
        });
    } catch (err) {
        console.error("❌ createInquiry ERROR:", err);
        // 전역 에러 핸들러로도 넘기고, 응답도 한 번 보냄
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

// (선택) 나중에 관리자용 목록 조회도 쓸 수 있게 기본 골격만 만들어 둠
export async function listInquiry(req, res, next) {
    try {
        const result = await pool.query(
            `
      SELECT
        id,
        inquiry_type,
        title,
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
