import pg from "pg";
const { Pool } = pg;

const DATABASE_URL = "postgresql://neondb_owner:npg_bQq0phW8nwJk@ep-yellow-wind-a1j52vje-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkSlots() {
  try {
    console.log("광고 슬롯 데이터 확인 중...\n");
    
    const result = await pool.query(`
      SELECT 
        s.id,
        s.page,
        s.position,
        s.store_id,
        s.business_name as slot_business_name,
        c.id as combined_id,
        c.business_name as combined_business_name,
        c.business_type as combined_business_type,
        c.business_category as combined_business_category,
        COALESCE(NULLIF(c.business_type, ''), c.business_category, '') AS final_category
      FROM admin_ad_slots s
      LEFT JOIN combined_store_info c ON s.store_id::text = c.id::text
      WHERE s.page = 'foodcategory'
      ORDER BY s.position
    `);
    
    console.log(`=== foodcategory 광고 슬롯 (총 ${result.rows.length}개) ===\n`);
    
    result.rows.forEach(row => {
      console.log(`위치: ${row.position}`);
      console.log(`  슬롯 ID: ${row.id}`);
      console.log(`  Store ID: ${row.store_id}`);
      console.log(`  슬롯 상호명: ${row.slot_business_name || '(없음)'}`);
      console.log(`  Combined 상호명: ${row.combined_business_name || '(없음)'}`);
      console.log(`  business_type: "${row.combined_business_type || ''}"`);
      console.log(`  business_category: "${row.combined_business_category || ''}"`);
      console.log(`  최종 category: "${row.final_category}"`);
      console.log('---\n');
    });
    
  } catch (error) {
    console.error("에러:", error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

checkSlots();
