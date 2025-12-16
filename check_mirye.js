import pool from './db.js';

async function checkMirye() {
  try {
    // 1. 미례헤어 기본 정보
    console.log('=== 미례헤어 기본 정보 ===');
    const storeResult = await pool.query(`
      SELECT id, business_name, business_number, main_image_url
      FROM combined_store_info 
      WHERE business_number = '2910802895' OR business_name LIKE '%미례헤어%'
    `);
    console.log(JSON.stringify(storeResult.rows, null, 2));
    
    if (storeResult.rows.length > 0) {
      const storeId = storeResult.rows[0].id;
      
      // 2. store_images 테이블 확인
      console.log('\n=== store_images 테이블 ===');
      const imagesResult = await pool.query(`
        SELECT * FROM store_images 
        WHERE CAST(store_id AS text) = $1
        ORDER BY sort_order, id
      `, [storeId]);
      console.log(JSON.stringify(imagesResult.rows, null, 2));
    }
    
    await pool.end();
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
}

checkMirye();
