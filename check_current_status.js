import pool from "./db.js";

async function checkStatus() {
  try {
    console.log("\n=== 현재 베스트 픽 슬롯 상태 ===");
    const slots = await pool.query(`
      SELECT position, business_no, business_name, store_id, store_type, link_url, image_url
      FROM admin_ad_slot_items
      WHERE page = 'index' AND position LIKE 'best_pick%'
      ORDER BY position
    `);
    
    console.log("\n슬롯 데이터:");
    slots.rows.forEach(row => {
      console.log(`\n[${row.position}]`);
      console.log(`  사업자번호: ${row.business_no}`);
      console.log(`  가게명: ${row.business_name}`);
      console.log(`  store_id: ${row.store_id}`);
      console.log(`  store_type: ${row.store_type}`);
      console.log(`  링크: ${row.link_url}`);
      console.log(`  이미지: ${row.image_url}`);
    });

    console.log("\n\n=== 사업자번호 0000000001 검색 (combined_store_info) ===");
    const lineHair = await pool.query(`
      SELECT id, business_name, business_number
      FROM combined_store_info
      WHERE regexp_replace(COALESCE(business_number::text,''), '[^0-9]', '', 'g') = '0000000001'
    `);
    console.log("라인헤어:", lineHair.rows);

    if (lineHair.rows[0]) {
      const storeId = lineHair.rows[0].id;
      console.log(`\n=== 라인헤어 이미지 (store_id=${storeId}) ===`);
      const images = await pool.query(
        "SELECT url FROM combined_store_images WHERE store_id=$1",
        [storeId]
      );
      console.log("이미지 목록:", images.rows);
    }

    console.log("\n\n=== 사업자번호 2910802895 검색 (store_info) ===");
    const sky = await pool.query(`
      SELECT id, business_name, business_number
      FROM store_info
      WHERE regexp_replace(COALESCE(business_number::text,''), '[^0-9]', '', 'g') = '2910802895'
    `);
    console.log("하늘식당:", sky.rows);

    if (sky.rows[0]) {
      const storeId = sky.rows[0].id;
      console.log(`\n=== 하늘식당 이미지 (store_id=${storeId}) ===`);
      const images = await pool.query(
        "SELECT url FROM store_images WHERE store_id=$1",
        [storeId]
      );
      console.log("이미지 목록:", images.rows);
    }

  } catch (err) {
    console.error("에러:", err);
  } finally {
    process.exit();
  }
}

checkStatus();
