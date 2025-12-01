import pool from "./db.js";

async function initManagerTextsTable() {
    try {
        const sql = `
            CREATE TABLE IF NOT EXISTS manager_texts (
                id SERIAL PRIMARY KEY,
                page VARCHAR(100) NOT NULL,
                position VARCHAR(100) NOT NULL,
                content TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(page, position)
            );
        `;

        await pool.query(sql);
        console.log("✅ manager_texts 테이블 생성 완료 (또는 이미 존재)");

    } catch (err) {
        console.error("❌ manager_texts 테이블 생성 오류:", err);
    } finally {
        process.exit(0);
    }
}

initManagerTextsTable();