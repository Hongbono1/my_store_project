// controllers/inquiryController.js
import pool from "../db.js";
import multer from "multer";
import path from "path";
import fs from "fs";

// Mall Hankook 표준: 업로드 디렉토리 자동 생성
const uploadDir = "public2/uploads/inquiry";
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log("📁 문의 업로드 폴더 생성:", uploadDir);
}

// Multer 설정 (Mall Hankook 패턴)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        const random = Math.round(Math.random() * 1e9);
        const unique = `${timestamp}-${random}`;
        cb(null, unique + path.extname(file.originalname));
    }
});

// 3개 이미지 업로드 미들웨어
export const uploadInquiry = multer({ 
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error("이미지 파일만 업로드 가능합니다."));
        }
    }
}).array("images", 3);

// 문의 등록 (Mall Hankook 표준 패턴)
export const createInquiry = async (req, res) => {
    try {
        const { title, content, user_name, user_phone } = req.body;

        // 입력 유효성 검사
        if (!title || !content || !user_name) {
            return res.status(400).json({ 
                success: false, 
                error: "제목, 내용, 이름은 필수 입력사항입니다." 
            });
        }

        // 업로드된 파일 경로 처리
        const filePaths = req.files?.map(file => `/uploads/inquiry/${file.filename}`) || [];
        console.log("📁 업로드된 파일:", filePaths);

        // 데이터베이스 삽입 (파라미터화된 쿼리)
        const result = await pool.query(`
            INSERT INTO inquiry (title, content, user_name, user_phone, file_paths, created_at)
            VALUES ($1, $2, $3, $4, $5, NOW())
            RETURNING id, created_at
        `, [
            title.trim(), 
            content.trim(), 
            user_name.trim(), 
            user_phone ? user_phone.trim() : null,
            JSON.stringify(filePaths)
        ]);

        // Mall Hankook 표준 응답
        res.json({ 
            success: true, 
            data: {
                id: result.rows[0].id,
                created_at: result.rows[0].created_at,
                uploaded_files: filePaths.length
            }
        });

    } catch (err) {
        console.error("❌ 문의 등록 오류:", err);
        res.status(500).json({ 
            success: false, 
            error: "서버 오류가 발생했습니다." 
        });
    }
};

// 문의 목록 조회 + Health Check (Mall Hankook 패턴)
export const getInquiryList = async (req, res) => {
    try {
        // Mall Hankook 표준: Health Check 처리
        if (req.query.health === 'check') {
            console.log("🏥 Mall Hankook API Health Check 요청");
            
            // 데이터베이스 연결 테스트
            const healthTest = await pool.query('SELECT NOW() as server_time, version() as pg_version');
            
            return res.json({
                success: true,
                service: "Mall Hankook Inquiry API",
                status: "healthy",
                timestamp: new Date().toISOString(),
                database: {
                    connected: true,
                    server_time: healthTest.rows[0].server_time,
                    version: healthTest.rows[0].pg_version.split(' ')[0] + ' ' + healthTest.rows[0].pg_version.split(' ')[1]
                },
                upload_dir: uploadDir,
                endpoints: [
                    "GET /api/inquiry - 문의 목록",
                    "POST /api/inquiry - 문의 등록 (이미지 업로드 지원)",
                    "GET /api/inquiry/:id - 문의 상세"
                ]
            });
        }

        // 일반 목록 조회 (기존 로직)
        const result = await pool.query(`
            SELECT 
                id, 
                title, 
                user_name, 
                created_at,
                CASE WHEN answer IS NOT NULL THEN true ELSE false END as has_answer,
                CASE WHEN file_paths IS NOT NULL AND file_paths::text != 'null' AND file_paths::text != '[]' 
                     THEN JSON_ARRAY_LENGTH(file_paths::json) 
                     ELSE 0 END as file_count
            FROM inquiry 
            ORDER BY id DESC
            LIMIT 50
        `);
        
        console.log(`📋 문의 목록 조회: ${result.rows.length}건`);
        res.json(result.rows);

    } catch (err) {
        console.error("❌ 문의 목록 조회/Health Check 오류:", err);
        
        // Health Check 실패 시 상세 정보 제공
        if (req.query.health === 'check') {
            return res.status(500).json({ 
                success: false,
                service: "Mall Hankook Inquiry API",
                status: "unhealthy",
                error: err.message,
                timestamp: new Date().toISOString(),
                database: {
                    connected: false,
                    error: err.code || "UNKNOWN_ERROR"
                }
            });
        }
        
        // 일반 목록 조회 실패
        res.status(500).json({ 
            success: false, 
            error: "서버 오류가 발생했습니다." 
        });
    }
};

// 문의 상세 조회
export const getInquiryDetail = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        
        if (isNaN(id)) {
            return res.status(400).json({ 
                success: false, 
                error: "유효하지 않은 문의 ID입니다." 
            });
        }

        const result = await pool.query(`
            SELECT 
                id, 
                title, 
                content, 
                user_name, 
                user_phone, 
                file_paths,
                answer, 
                created_at, 
                updated_at
            FROM inquiry 
            WHERE id = $1
        `, [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ 
                success: false, 
                error: "문의를 찾을 수 없습니다." 
            });
        }

        const inquiry = result.rows[0];
        
        // JSON 파일 경로 파싱 (Mall Hankook 패턴)
        if (inquiry.file_paths) {
            try {
                inquiry.file_paths = JSON.parse(inquiry.file_paths);
            } catch (parseError) {
                console.warn("⚠️ file_paths JSON 파싱 오류:", parseError);
                inquiry.file_paths = [];
            }
        } else {
            inquiry.file_paths = [];
        }

        console.log(`📋 문의 상세 조회: ID ${id}, 첨부파일 ${inquiry.file_paths.length}개`);
        res.json(inquiry);

    } catch (err) {
        console.error("❌ 문의 상세 조회 오류:", err);
        res.status(500).json({ 
            success: false, 
            error: "서버 오류가 발생했습니다." 
        });
    }
};

// inquiryregister.html 스크립트 수정 부분
// 6. 페이지 로드 시 초기화
document.addEventListener("DOMContentLoaded", function() {
    loadComponents();
    
    // Mall Hankook API 헬스체크 (에러 처리 강화)
    fetch("/api/inquiry?health=check")
        .then(async res => {
            console.log("🏥 API Health Check Status:", res.status);
            
            if (res.ok) {
                const healthData = await res.json();
                console.log("✅ Mall Hankook API 정상 작동");
                console.log("📊 Health Data:", healthData);
            } else {
                const errorData = await res.json();
                console.warn("⚠️ API Health Check 실패:");
                console.warn("📊 Error Data:", errorData);
            }
        })
        .catch(err => {
            console.error("❌ API Health Check 네트워크 오류:", err.message);
        });
});
