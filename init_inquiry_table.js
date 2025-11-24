import pool from "./db.js";

async function initInquiryTable() {
    try {
        console.log("🔍 inquiry 테이블 초기화 시작...");
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS inquiry (
                id SERIAL PRIMARY KEY,
                inquiry_type VARCHAR(50) DEFAULT 'general',
                title VARCHAR(255) NOT NULL,
                content TEXT NOT NULL,
                writer_name VARCHAR(100),
                writer_phone VARCHAR(20),
                writer_email VARCHAR(100),
                image1 VARCHAR(500),
                image2 VARCHAR(500),
                image3 VARCHAR(500),
                is_secret BOOLEAN DEFAULT FALSE,
                answer TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `);
        
        console.log("✅ inquiry 테이블이 생성/확인되었습니다.");
        
    } catch (error) {
        console.error("❌ 테이블 초기화 오류:", error.message);
    } finally {
        process.exit(0);
    }
}

initInquiryTable();