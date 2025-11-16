import "dotenv/config";
import pool from "./db.js";

async function addCoordinateColumns() {
  try {
    console.log("🔍 lat/lng 컬럼 추가 중...");

    // lat 컬럼 추가
    await pool.query(`
      ALTER TABLE traditional_market 
      ADD COLUMN IF NOT EXISTS lat DECIMAL(10, 7);
    `);

    // lng 컬럼 추가
    await pool.query(`
      ALTER TABLE traditional_market 
      ADD COLUMN IF NOT EXISTS lng DECIMAL(10, 7);
    `);

    console.log("✅ lat/lng 컬럼 추가 완료!");

    // 테이블 구조 확인
    const columns = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'traditional_market'
      ORDER BY ordinal_position;
    `);

    console.log("\n📋 업데이트된 테이블 구조:");
    console.table(columns.rows);

    process.exit(0);
  } catch (error) {
    console.error("❌ 컬럼 추가 중 오류:", error);
    process.exit(1);
  }
}

addCoordinateColumns();
