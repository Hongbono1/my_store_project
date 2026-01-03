import pool from "./db.js";

async function checkAllPages() {
  try {
    // 전체 page 종류와 개수 확인
    const { rows } = await pool.query(`
      SELECT page, position, slot_type, slot_mode, 
             SUBSTRING(text, 1, 20) as text_preview,
             business_name
      FROM admin_ad_slots
      ORDER BY page, position
      LIMIT 100
    `);
    
    console.log("\n=== admin_ad_slots 테이블 전체 데이터 ===");
    console.table(rows);
    
    const { rows: summary } = await pool.query(`
      SELECT page, COUNT(*) as count
      FROM admin_ad_slots
      GROUP BY page
      ORDER BY page
    `);
    
    console.log("\n=== 페이지별 개수 ===");
    console.table(summary);
    
  } catch (error) {
    console.error("❌ 오류:", error);
  } finally {
    await pool.end();
  }
}

checkAllPages();
