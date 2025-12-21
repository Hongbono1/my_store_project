import "dotenv/config";
import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

(async () => {
  try {
    const result = await pool.query(`
      UPDATE public.admin_ad_slots
      SET link_url = regexp_replace(COALESCE(link_url,''), 'type=store\\b', 'type=store_info')
      WHERE page='foodcategory'
        AND table_source='store_info'
        AND COALESCE(link_url,'') LIKE '%/ndetail.html%'
        AND COALESCE(link_url,'') LIKE '%type=store%'
      RETURNING id, position, link_url
    `);
    
    console.log(`✅ 수정된 슬롯: ${result.rowCount}개`);
    result.rows.forEach(row => {
      console.log(`  - ID ${row.id} | ${row.position} | ${row.link_url}`);
    });
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ 오류:', error);
    process.exit(1);
  }
})();
