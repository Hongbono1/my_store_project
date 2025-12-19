import pool from "./db.js";

async function checkLineHair() {
  try {
    console.log("🔍 사업자번호 0000000001 검색 중...\n");

    // combined_store_info 테이블 확인
    const combined = await pool.query(`
      SELECT id, business_name, business_number
      FROM combined_store_info 
      WHERE regexp_replace(COALESCE(business_number::text,''), '[^0-9]', '', 'g') = '0000000001'
    `);
    console.log("📋 combined_store_info 결과:", combined.rows);

    // combined_store_images 테이블 확인
    if (combined.rows.length > 0) {
      const storeId = combined.rows[0].id;
      const images = await pool.query(`
        SELECT url 
        FROM combined_store_images 
        WHERE store_id = $1 
        ORDER BY id DESC 
        LIMIT 3
      `, [storeId]);
      console.log("\n📸 combined_store_images 결과:", images.rows);
    }

    // store_info 테이블 확인
    const store = await pool.query(`
      SELECT id, business_name, business_number
      FROM store_info 
      WHERE regexp_replace(COALESCE(business_number::text,''), '[^0-9]', '', 'g') = '0000000001'
    `);
    console.log("\n📋 store_info 결과:", store.rows);

    // store_images 테이블 확인
    if (store.rows.length > 0) {
      const storeId = store.rows[0].id;
      const images = await pool.query(`
        SELECT url 
        FROM store_images 
        WHERE store_id = $1 
        ORDER BY id DESC 
        LIMIT 3
      `, [storeId]);
      console.log("\n📸 store_images 결과:", images.rows);
    }

    await pool.end();
  } catch (err) {
    console.error("❌ 오류:", err);
    await pool.end();
  }
}

checkLineHair();
