// fix_foodcategory_table_source.js
// foodcategory 페이지의 NULL/빈 table_source를 store_info로 통일

import pool from "./db.js";

async function fixTableSource() {
  const client = await pool.connect();
  
  try {
    console.log("🔧 foodcategory 페이지의 table_source 정리 시작...");
    
    await client.query("BEGIN");
    
    // NULL 또는 빈 문자열인 경우 store_info로 설정
    const result = await client.query(`
      UPDATE public.admin_ad_slots
      SET table_source = 'store_info'
      WHERE page = 'foodcategory'
        AND (table_source IS NULL OR table_source = '')
      RETURNING id, position, store_id, business_name
    `);
    
    await client.query("COMMIT");
    
    console.log(`✅ ${result.rowCount}개 레코드 업데이트 완료\n`);
    
    if (result.rows.length > 0) {
      console.log("업데이트된 슬롯:");
      result.rows.forEach(row => {
        console.log(`  - ID: ${row.id} | Position: ${row.position} | Store ID: ${row.store_id} | Name: ${row.business_name || '(없음)'}`);
      });
    } else {
      console.log("업데이트할 레코드가 없습니다.");
    }
    
    // 최종 상태 확인
    const checkResult = await client.query(`
      SELECT 
        page,
        table_source,
        COUNT(*) as count
      FROM public.admin_ad_slots
      WHERE page = 'foodcategory'
      GROUP BY page, table_source
      ORDER BY table_source
    `);
    
    console.log("\n📊 foodcategory 페이지 table_source 분포:");
    checkResult.rows.forEach(row => {
      console.log(`  - ${row.table_source || '(NULL)'}: ${row.count}개`);
    });
    
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ 오류 발생:", error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

fixTableSource().catch(console.error);
