import pg from "pg";
const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_bQq0phW8nwJk@ep-yellow-wind-a1j52vje-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function findHaneul() {
  try {
    console.log("하늘식당 검색 중...\n");
    
    // 1. open_stores 테이블
    console.log("=== open_stores 테이블 ===");
    const open = await pool.query(`
      SELECT id, business_name, business_type, business_category 
      FROM open_stores 
      WHERE business_name LIKE '%하늘%'
      LIMIT 5
    `);
    console.log(`발견: ${open.rows.length}건`);
    open.rows.forEach(r => console.log(`- ${r.business_name} (type: ${r.business_type}, category: ${r.business_category})`));
    
    // 2. store_pride 테이블
    console.log("\n=== store_pride 테이블 ===");
    const pride = await pool.query(`
      SELECT id, business_name, business_type, business_category 
      FROM store_pride 
      WHERE business_name LIKE '%하늘%'
      LIMIT 5
    `);
    console.log(`발견: ${pride.rows.length}건`);
    pride.rows.forEach(r => console.log(`- ${r.business_name} (type: ${r.business_type}, category: ${r.business_category})`));
    
    // 3. combined_store_info 테이블
    console.log("\n=== combined_store_info 테이블 ===");
    const combined = await pool.query(`
      SELECT id, business_name, business_type, business_category 
      FROM combined_store_info 
      WHERE business_name LIKE '%하늘%'
      LIMIT 5
    `);
    console.log(`발견: ${combined.rows.length}건`);
    combined.rows.forEach(r => console.log(`- ${r.business_name} (type: ${r.business_type}, category: ${r.business_category})`));
    
    // 4. 광고 슬롯에 등록된 모든 가게
    console.log("\n=== foodcategory 광고 슬롯 전체 ===");
    const slots = await pool.query(`
      SELECT 
        s.position,
        s.store_id,
        s.business_name as slot_name,
        c.business_name as store_name,
        c.business_type,
        c.business_category
      FROM admin_ad_slots s
      LEFT JOIN combined_store_info c ON s.store_id::text = c.id::text
      WHERE s.page = 'foodcategory'
      ORDER BY s.position
    `);
    console.log(`총 ${slots.rows.length}개 슬롯`);
    slots.rows.forEach(r => {
      const name = r.store_name || r.slot_name || '(미설정)';
      console.log(`- ${r.position}: ${name} (type: ${r.business_type || 'N/A'}, category: ${r.business_category || 'N/A'})`);
    });
    
  } catch (error) {
    console.error("에러:", error.message);
  } finally {
    await pool.end();
  }
}

findHaneul();
