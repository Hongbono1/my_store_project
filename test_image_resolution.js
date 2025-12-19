import pool from "./db.js";

async function testImageResolution() {
  const client = await pool.connect();
  
  try {
    console.log("\n=== 베스트 픽 1 (라인헤어) 이미지 해결 테스트 ===\n");
    
    const slot = {
      store_type: null,
      store_id: '1',
      business_no: '0000000001',
      business_name: '라인헤어'
    };
    
    console.log("슬롯 정보:", slot);
    
    // store_type 추론
    const bizDigits = slot.business_no?.replace(/[^\d]/g, '');
    console.log("\n1. 사업자번호 추출:", bizDigits);
    
    // combined_store_info에서 검색
    console.log("\n2. combined_store_info 검색:");
    const combined = await client.query(`
      SELECT id, business_name, business_number
      FROM combined_store_info
      WHERE regexp_replace(COALESCE(business_number::text,''), '[^0-9]', '', 'g') = $1
    `, [bizDigits]);
    console.log("  결과:", combined.rows);
    
    // store_info에서 검색
    console.log("\n3. store_info 검색:");
    const storeInfo = await client.query(`
      SELECT id, business_name, business_number
      FROM store_info
      WHERE regexp_replace(COALESCE(business_number::text,''), '[^0-9]', '', 'g') = $1
    `, [bizDigits]);
    console.log("  결과:", storeInfo.rows);
    
    // combined_store_images 검색
    if (combined.rows.length > 0) {
      const id = combined.rows[0].id;
      console.log(`\n4. combined_store_images 검색 (store_id=${id}):`);
      const images = await client.query(
        "SELECT url FROM combined_store_images WHERE store_id=$1",
        [id]
      );
      console.log("  이미지:", images.rows);
    }
    
    // store_images 검색 (store_id로)
    console.log(`\n5. store_images 검색 (store_id=${slot.store_id}):`);
    const storeImages = await client.query(
      "SELECT url FROM store_images WHERE store_id=$1",
      [slot.store_id]
    );
    console.log("  이미지:", storeImages.rows);
    
  } catch (err) {
    console.error("에러:", err);
  } finally {
    client.release();
    process.exit();
  }
}

testImageResolution();
