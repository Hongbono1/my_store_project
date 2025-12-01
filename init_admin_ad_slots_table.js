import pool from "./db.js";

async function initAdminAdSlotsTable() {
    try {
        const sql = `
            CREATE TABLE IF NOT EXISTS admin_ad_slots (
                id SERIAL PRIMARY KEY,
                page VARCHAR(100) NOT NULL,
                position VARCHAR(100) NOT NULL,
                slot_type VARCHAR(20) DEFAULT 'banner',
                image_url TEXT,
                link_url TEXT,
                text_content TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(page, position)
            );
        `;

        await pool.query(sql);
        console.log("✅ admin_ad_slots 테이블 생성 완료 (또는 이미 존재)");

    } catch (err) {
        console.error("❌ admin_ad_slots 테이블 생성 오류:", err);
    } finally {
        process.exit(0);
    }
}

initAdminAdSlotsTable();