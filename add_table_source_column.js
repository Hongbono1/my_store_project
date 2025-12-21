import pg from "pg";
const { Pool } = pg;

const DATABASE_URL = "postgresql://neondb_owner:npg_bQq0phW8nwJk@ep-yellow-wind-a1j52vje-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function addTableSourceColumn() {
  try {
    console.log("admin_ad_slots 테이블에 table_source 컬럼 추가 중...\n");

    // 1. 컬럼 존재 여부 확인
    const checkCol = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'admin_ad_slots' 
        AND column_name = 'table_source'
    `);

    if (checkCol.rows.length > 0) {
      console.log("✅ table_source 컬럼이 이미 존재합니다.");
    } else {
      // 2. 컬럼 추가
      await pool.query(`
        ALTER TABLE admin_ad_slots 
        ADD COLUMN table_source TEXT DEFAULT 'combined_store_info'
      `);
      console.log("✅ table_source 컬럼 추가 완료");
    }

    // 3. 기존 데이터에 대해 올바른 table_source 설정
    console.log("\n기존 데이터의 table_source 업데이트 중...");
    
    const result = await pool.query(`
      UPDATE admin_ad_slots a
      SET table_source = CASE
        WHEN EXISTS (
          SELECT 1 FROM store_info s 
          WHERE s.id = a.store_id 
            AND regexp_replace(COALESCE(s.business_number::text,''), '[^0-9]', '', 'g') = a.business_no
        ) THEN 'store_info'
        WHEN EXISTS (
          SELECT 1 FROM combined_store_info c 
          WHERE c.id = a.store_id 
            AND regexp_replace(COALESCE(c.business_number::text,''), '[^0-9]', '', 'g') = a.business_no
        ) THEN 'combined_store_info'
        WHEN EXISTS (
          SELECT 1 FROM food_stores f 
          WHERE f.id = a.store_id 
            AND regexp_replace(COALESCE(f.business_number::text,''), '[^0-9]', '', 'g') = a.business_no
        ) THEN 'food_stores'
        ELSE 'combined_store_info'
      END
      WHERE store_id IS NOT NULL
      RETURNING id, store_id, business_name, table_source
    `);

    console.log(`✅ ${result.rows.length}개 행 업데이트 완료\n`);
    
    if (result.rows.length > 0) {
      console.log("=== 업데이트된 슬롯 ===");
      result.rows.forEach(r => {
        console.log(`ID: ${r.id} | Store ID: ${r.store_id} | ${r.business_name} → ${r.table_source}`);
      });
    }

    console.log("\n✅ 마이그레이션 완료!");
    
  } catch (error) {
    console.error("❌ 에러:", error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

addTableSourceColumn();
