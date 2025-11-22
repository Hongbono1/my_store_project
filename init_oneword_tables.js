import pool from "./db.js";

async function createOnewordTables() {
  try {
    // 1. 검색 로그 테이블
    await pool.query(`
      CREATE TABLE IF NOT EXISTS search_logs (
        id SERIAL PRIMARY KEY,
        region VARCHAR(50) NOT NULL,
        keyword VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("✅ search_logs 테이블 생성 완료");

    // 2. 메뉴 클릭 로그 테이블
    await pool.query(`
      CREATE TABLE IF NOT EXISTS menu_click_logs (
        id SERIAL PRIMARY KEY,
        region VARCHAR(50) NOT NULL,
        menu_name VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("✅ menu_click_logs 테이블 생성 완료");

    // 3. 조회수 로그 테이블
    await pool.query(`
      CREATE TABLE IF NOT EXISTS view_logs (
        id SERIAL PRIMARY KEY,
        region VARCHAR(50) NOT NULL,
        store_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("✅ view_logs 테이블 생성 완료");

    // 인덱스 생성 (성능 최적화)
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_search_logs_region_time 
      ON search_logs(region, created_at DESC)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_menu_click_region_time 
      ON menu_click_logs(region, created_at DESC)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_view_logs_region_time 
      ON view_logs(region, created_at DESC)
    `);
    
    console.log("✅ 인덱스 생성 완료");

    console.log("\n🎉 모든 테이블 초기화 완료!");
    process.exit(0);
  } catch (error) {
    console.error("❌ 테이블 생성 실패:", error);
    process.exit(1);
  }
}

createOnewordTables();
