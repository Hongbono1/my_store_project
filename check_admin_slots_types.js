import pg from "pg";
const { Pool } = pg;

const DATABASE_URL = "postgresql://neondb_owner:npg_bQq0phW8nwJk@ep-yellow-wind-a1j52vje-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkTypes() {
  try {
    const result = await pool.query(`
      SELECT 
        column_name,
        data_type,
        udt_name
      FROM information_schema.columns 
      WHERE table_name = 'admin_ad_slots'
      ORDER BY ordinal_position
    `);
    
    console.log("=== admin_ad_slots 컬럼 타입 ===\n");
    result.rows.forEach(r => {
      console.log(`${r.column_name}: ${r.data_type} (${r.udt_name})`);
    });
    
  } catch (error) {
    console.error("에러:", error.message);
  } finally {
    await pool.end();
  }
}

checkTypes();
