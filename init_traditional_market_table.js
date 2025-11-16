import "dotenv/config";
import pool from "./db.js";

async function initTraditionalMarketTables() {
  try {
    console.log("🔍 traditional_market 테이블 확인 중...");

    // 1. traditional_market 테이블 생성
    await pool.query(`
      CREATE TABLE IF NOT EXISTS traditional_market (
        id SERIAL PRIMARY KEY,
        market_name TEXT NOT NULL,
        address TEXT NOT NULL,
        lat DECIMAL(10, 7),             -- 위도
        lng DECIMAL(10, 7),             -- 경도
        main_img TEXT NOT NULL,         -- 대표 이미지
        phone TEXT,
        opening_hours TEXT NOT NULL,    -- 운영 시간
        main_products TEXT NOT NULL,    -- 주요 품목/특산물
        event_info TEXT,                -- 이벤트/축제
        facilities TEXT,                -- 편의시설
        parking_available TEXT NOT NULL, -- "있음", "없음"
        parking_img TEXT,               -- 주차장 사진
        transport_info TEXT,            -- 대중교통 안내
        transport_img TEXT,             -- 대중교통 약도 이미지
        free_pr TEXT,                   -- 운영자 한마디
        qa_mode TEXT,                   -- "fixed" or "custom"
        qa_list JSONB,                  -- 질문/답변 JSON 저장
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("✅ traditional_market 테이블 확인/생성 완료");

    // 2. traditional_market_images 테이블 생성
    await pool.query(`
      CREATE TABLE IF NOT EXISTS traditional_market_images (
        id SERIAL PRIMARY KEY,
        market_id INTEGER REFERENCES traditional_market(id) ON DELETE CASCADE,
        img_path TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("✅ traditional_market_images 테이블 확인/생성 완료");

    // 3. 테이블 구조 확인
    const marketColumns = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'traditional_market'
      ORDER BY ordinal_position;
    `);

    const imagesColumns = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'traditional_market_images'
      ORDER BY ordinal_position;
    `);

    console.log("\n📋 traditional_market 테이블 구조:");
    console.table(marketColumns.rows);

    console.log("\n📋 traditional_market_images 테이블 구조:");
    console.table(imagesColumns.rows);

    console.log("\n✅ 전통시장 테이블 초기화 완료!");
    process.exit(0);
  } catch (error) {
    console.error("❌ 테이블 초기화 중 오류:", error);
    process.exit(1);
  }
}

initTraditionalMarketTables();
