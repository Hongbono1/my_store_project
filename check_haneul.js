import pg from "pg";
const { Pool } = pg;

// .env 파일에서 DATABASE_URL을 읽거나, 직접 입력
const DATABASE_URL = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_bQq0phW8nwJk@ep-yellow-wind-a1j52vje-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkHaneul() {
  try {
    console.log("데이터베이스 연결 중...");
    
    // 하늘식당 데이터 확인
    const result = await pool.query(`
      SELECT 
        id, 
        business_name, 
        business_type, 
        business_category,
        business_subcategory
      FROM combined_store_info 
      WHERE business_name LIKE '%하늘%'
    `);
    
    console.log("\n=== 하늘식당 데이터 ===");
    result.rows.forEach(row => {
      console.log(`ID: ${row.id}`);
      console.log(`상호명: ${row.business_name}`);
      console.log(`business_type: "${row.business_type}"`);
      console.log(`business_category: "${row.business_category}"`);
      console.log(`business_subcategory: "${row.business_subcategory}"`);
      console.log("---");
    });
    
    // 광고 슬롯에서 하늘식당 확인
    const slotResult = await pool.query(`
      SELECT 
        s.id,
        s.page,
        s.position,
        s.store_id,
        s.business_name as slot_business_name,
        c.business_name as store_business_name,
        c.business_type,
        c.business_category,
        COALESCE(NULLIF(c.business_type, ''), c.business_category, '') AS category
      FROM admin_ad_slots s
      LEFT JOIN combined_store_info c ON s.store_id::text = c.id::text
      WHERE s.page = 'foodcategory' AND c.business_name LIKE '%하늘%'
      ORDER BY s.position
    `);
    
    console.log("\n=== foodcategory 광고 슬롯 (하늘식당) ===");
    slotResult.rows.forEach(row => {
      console.log(`슬롯 ID: ${row.id}`);
      console.log(`위치: ${row.position}`);
      console.log(`Store ID: ${row.store_id}`);
      console.log(`상호명: ${row.store_business_name}`);
      console.log(`business_type: "${row.business_type}"`);
      console.log(`business_category: "${row.business_category}"`);
      console.log(`최종 category: "${row.category}"`);
      console.log("---");
    });
    
  } catch (error) {
    console.error("에러:", error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

checkHaneul();
