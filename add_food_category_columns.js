// add_food_category_columns.js
// open_stores 테이블에 business_category, detail_category 컬럼 추가

import "dotenv/config";
import pool from "./db.js";

async function addCategoryColumns() {
  try {
    console.log("🔧 open_stores 테이블 컬럼 추가 시작...");

    // 1. business_category, detail_category 컬럼 추가
    await pool.query(`
      ALTER TABLE open_stores 
      ADD COLUMN IF NOT EXISTS business_category VARCHAR(100),
      ADD COLUMN IF NOT EXISTS detail_category VARCHAR(100);
    `);
    console.log("✅ business_category, detail_category 컬럼 추가 완료");

    // 2. 기존 category 데이터를 business_category로 복사
    const result = await pool.query(`
      UPDATE open_stores 
      SET business_category = category 
      WHERE business_category IS NULL AND category IS NOT NULL
      RETURNING id, store_name, category, business_category;
    `);
    
    if (result.rows.length > 0) {
      console.log(`✅ ${result.rows.length}개 레코드의 category → business_category 복사 완료`);
      console.log("샘플:", result.rows.slice(0, 3));
    } else {
      console.log("ℹ️ 복사할 기존 데이터가 없습니다.");
    }

    // 3. 테이블 구조 확인
    const columns = await pool.query(`
      SELECT column_name, data_type, character_maximum_length 
      FROM information_schema.columns 
      WHERE table_name = 'open_stores' 
      AND column_name IN ('category', 'business_category', 'detail_category')
      ORDER BY ordinal_position;
    `);
    
    console.log("\n📊 open_stores 테이블 카테고리 관련 컬럼:");
    console.table(columns.rows);

    // 4. 데이터 샘플 확인
    const sample = await pool.query(`
      SELECT id, store_name, category, business_category, detail_category 
      FROM open_stores 
      LIMIT 5;
    `);
    
    console.log("\n📋 데이터 샘플:");
    console.table(sample.rows);

  } catch (error) {
    console.error("❌ 오류 발생:", error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

addCategoryColumns();
