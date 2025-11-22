import pool from "./db.js";
import dotenv from "dotenv";

dotenv.config();

async function initTables() {
    try {
        // post_likes 테이블 생성 (추천 기록)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS post_likes (
                id SERIAL PRIMARY KEY,
                post_id INTEGER NOT NULL,
                nickname VARCHAR(50) NOT NULL,
                created_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(post_id, nickname)
            )
        `);
        console.log("✅ post_likes 테이블 생성 완료");

        // post_reports 테이블 생성 (신고 기록)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS post_reports (
                id SERIAL PRIMARY KEY,
                post_id INTEGER NOT NULL,
                nickname VARCHAR(50) NOT NULL,
                created_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(post_id, nickname)
            )
        `);
        console.log("✅ post_reports 테이블 생성 완료");

        process.exit(0);
    } catch (error) {
        console.error("❌ 테이블 생성 오류:", error);
        process.exit(1);
    }
}

initTables();
