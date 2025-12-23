// add_store_info_columns.js - admin_ad_slots 테이블에 가게 정보 컬럼 추가
import pool from "./db.js";

async function addStoreInfoColumns() {
  try {
    console.log("🔧 admin_ad_slots 테이블에 가게 정보 컬럼 추가 중...");

    await pool.query(`
      ALTER TABLE public.admin_ad_slots 
      ADD COLUMN IF NOT EXISTS store_type VARCHAR(50),
      ADD COLUMN IF NOT EXISTS store_id VARCHAR(50),
      ADD COLUMN IF NOT EXISTS business_name VARCHAR(255);
    `);

    console.log("✅ 컬럼 추가 완료");

    // 인덱스 추가
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_admin_ad_slots_store 
      ON public.admin_ad_slots(store_type, store_id);
    `);

    console.log("✅ 인덱스 추가 완료");

    // 코멘트 추가
    await pool.query(`
      COMMENT ON COLUMN public.admin_ad_slots.store_type IS '가게 타입 (combined_store_info, store_info 등)';
    `);
    await pool.query(`
      COMMENT ON COLUMN public.admin_ad_slots.store_id IS '가게 ID';
    `);
    await pool.query(`
      COMMENT ON COLUMN public.admin_ad_slots.business_name IS '사업자명 (표시용)';
    `);

    console.log("✅ 코멘트 추가 완료");

    // 테이블 구조 확인
    const result = await pool.query(`
      SELECT column_name, data_type, character_maximum_length, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'admin_ad_slots'
        AND column_name IN ('store_type', 'store_id', 'business_name')
      ORDER BY ordinal_position;
    `);

    console.log("\n📋 추가된 컬럼 정보:");
    console.table(result.rows);

    console.log("\n🎉 모든 작업 완료!");
  } catch (err) {
    console.error("❌ 오류 발생:", err);
  } finally {
    await pool.end();
  }
}

addStoreInfoColumns();
