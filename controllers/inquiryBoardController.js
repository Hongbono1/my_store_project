// controllers/inquiryBoardController.js
import pool from "../db.js";
import multer from "multer";
import path from "path";
import fs from "fs";

// Mall Hankook 표준: public2/uploads/inquiry 경로
const uploadDir = path.join(process.cwd(), "public2", "uploads", "inquiry");

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log("📁 문의 업로드 폴더 생성:", uploadDir);
}

// Multer 설정 (Mall Hankook 표준)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        const random = Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        cb(null, `${timestamp}-${random}${ext}`);
    },
});

export const uploadInquiry = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|gif|webp/;
        const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
        const mimeOk = allowed.test(file.mimetype);

        if (extOk && mimeOk) {
            cb(null, true);
        } else {
            cb(new Error("이미지 파일(jpg, png, gif, webp)만 업로드 가능합니다."));
        }
    },
}).array("images", 3);

export const createInquiry = async (req, res) => {
    try {
        const { 
            inquiry_type,
            title, 
            content, 
            writer_name, 
            writer_phone, 
            writer_email 
        } = req.body || {};

        // 필수값 체크
        if (!title || !content || !writer_name) {
            return res.status(400).json({
                ok: false,  // ✅ Frontend 호환성을 위해 ok 사용
                error: "제목, 내용, 이름은 필수 입력사항입니다.",
            });
        }

        // 비밀글 처리 (Mall Hankook 표준)
        const is_secret = req.body?.is_secret === "on" || req.body?.is_secret === "true";

        // 업로드된 파일 경로 처리
        const files = Array.isArray(req.files) ? req.files.slice(0, 3) : [];
        const filePaths = files.map(file => `/uploads/inquiry/${file.filename}`);
        
        console.log("📁 업로드된 문의 이미지:", filePaths);

        // Mall Hankook 표준 DB 삽입
        const result = await pool.query(`
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
                is_secret,
                created_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
            RETURNING id, created_at
        `, [
            inquiry_type || 'general',
            title.trim(),
            content.trim(), 
            writer_name.trim(),
            writer_phone ? writer_phone.trim() : null,
            writer_email ? writer_email.trim() : null,
            filePaths[0] || null,
            filePaths[1] || null,
            filePaths[2] || null,
            is_secret
        ]);

        const row = result.rows[0];

        // ✅ Frontend 호환성을 위해 ok: true 사용
        return res.status(201).json({
            ok: true,
            id: row.id,
            message: "문의가 성공적으로 등록되었습니다.",
            created_at: row.created_at,
            uploaded_files: filePaths.length
        });

    } catch (err) {
        console.error("❌ 문의 등록 오류:", err);
        return res.status(500).json({
            ok: false,  // ✅ Frontend 호환성을 위해 ok 사용
            error: "서버 오류가 발생했습니다.",
        });
    }
};

export const getInquiryList = async (req, res) => {
    try {
        // Health Check 처리
        if (req.query.health === 'check') {
            console.log("🏥 Mall Hankook API Health Check");
            
            const healthTest = await pool.query('SELECT NOW() as server_time');
            
            return res.json({
                ok: true,  // ✅ 일관성을 위해 ok 사용
                service: "Mall Hankook Inquiry API",
                status: "healthy",
                timestamp: new Date().toISOString(),
                database: {
                    connected: true,
                    server_time: healthTest.rows[0].server_time
                }
            });
        }

        // 일반 목록 조회
        const result = await pool.query(`
            SELECT 
                id,
                inquiry_type,
                title,
                writer_name,
                created_at,
                CASE WHEN answer IS NOT NULL AND answer != '' THEN true ELSE false END as has_answer,
                CASE 
                    WHEN image1 IS NOT NULL THEN 1 ELSE 0 
                END +
                CASE 
                    WHEN image2 IS NOT NULL THEN 1 ELSE 0 
                END +
                CASE 
                    WHEN image3 IS NOT NULL THEN 1 ELSE 0 
                END as file_count
            FROM inquiry
            ORDER BY created_at DESC
            LIMIT 50
        `);

        console.log(`📋 문의 목록 조회: ${result.rows.length}건`);
        
        // Mall Hankook 표준: 목록 조회는 직접 배열 응답
        return res.json(result.rows);

    } catch (err) {
        console.error("❌ 문의 목록 조회 오류:", err);
        
        if (req.query.health === 'check') {
            return res.status(500).json({
                ok: false,
                service: "Mall Hankook Inquiry API", 
                status: "unhealthy",
                error: err.message
            });
        }
        
        return res.status(500).json({
            ok: false,
            error: "서버 오류가 발생했습니다.",
        });
    }
};

export const getInquiryDetail = async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (Number.isNaN(id)) {
            return res.status(400).json({
                ok: false,
                error: "유효하지 않은 문의 ID입니다.",
            });
        }

        const result = await pool.query(`
            SELECT 
                id,
                inquiry_type,
                title,
                content,
                writer_name,
                writer_phone, 
                writer_email,
                image1,      -- ✅ DB 컬럼명과 일치
                image2,      -- ✅ DB 컬럼명과 일치
                image3,      -- ✅ DB 컬럼명과 일치
                is_secret,
                answer,
                created_at,
                updated_at
            FROM inquiry
            WHERE id = $1
        `, [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({
                ok: false,
                error: "문의를 찾을 수 없습니다.",
            });
        }

        const inquiry = result.rows[0];

        console.log(`📋 문의 상세 조회: ID ${id}`);
        console.log(`📁 첨부 이미지:`, {
            image1: inquiry.image1,
            image2: inquiry.image2,
            image3: inquiry.image3
        });
        
        // ✅ Frontend 호환 응답 구조
        return res.json({
            ok: true,
            item: inquiry
        });

    } catch (err) {
        console.error("❌ 문의 상세 조회 오류:", err);
        return res.status(500).json({
            ok: false,
            error: "서버 오류가 발생했습니다.",
        });
    }
};
