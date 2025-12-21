import pg from "pg";
const { Pool } = pg;

const DATABASE_URL = "postgresql://neondb_owner:npg_bQq0phW8nwJk@ep-yellow-wind-a1j52vje-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function searchStores() {
  try {
    // combined_store_info 전체 조회
    const result = await pool.query(`
      SELECT id, business_name, business_type, business_category
      FROM combined_store_info
      ORDER BY id
      LIMIT 20
    `);
    
    console.log(`=== combined_store_info (총 ${result.rows.length}건) ===\n`);
    
    result.rows.forEach(row => {
      console.log(`ID: ${row.id} | ${row.business_name} | type: ${row.business_type} | category: ${row.business_category}`);
    });
    
  } catch (error) {
    console.error("에러:", error.message);
  } finally {
    await pool.end();
  }
}

searchStores();
