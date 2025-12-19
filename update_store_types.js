import pool from "./db.js";

async function updateStoreTypes() {
  try {
    console.log("\n=== 베스트 픽 슬롯 store_type 및 이미지 업데이트 ===");

    // 베스트 픽 1 (현재 하늘식당) - store_info
    console.log("\n1. 베스트 픽 1 (하늘식당) store_type 업데이트...");
    await pool.query(`
      UPDATE admin_ad_slot_items
      SET store_type = 'store_info'
      WHERE page = 'index' 
        AND position = 'best_pick_1'
        AND business_no = '2910802895'
    `);
    console.log("✅ 하늘식당 store_type = 'store_info'");

    // 베스트 픽 2 (현재 라인헤어) - combined
    console.log("\n2. 베스트 픽 2 (라인헤어) store_type 및 이미지 업데이트...");
    await pool.query(`
      UPDATE admin_ad_slot_items
      SET store_type = 'combined',
          image_url = '/uploads/dc8b5096-30d0-4a5d-b2a5-cddb4d619e5b.jpg'
      WHERE page = 'index' 
        AND position = 'best_pick_2'
        AND business_no = '0000000001'
    `);
    console.log("✅ 라인헤어 store_type = 'combined', 이미지 수정");

    console.log("\n=== 수정 후 상태 확인 ===");
    const result = await pool.query(`
      SELECT position, business_no, business_name, store_type, link_url, image_url
      FROM admin_ad_slot_items
      WHERE page = 'index' AND position LIKE 'best_pick%'
      ORDER BY position
    `);

    result.rows.forEach(row => {
      console.log(`\n[${row.position}]`);
      console.log(`  가게: ${row.business_name} (${row.business_no})`);
      console.log(`  store_type: ${row.store_type}`);
      console.log(`  링크: ${row.link_url}`);
      console.log(`  이미지: ${row.image_url}`);
    });

    console.log("\n✅ 수정 완료!");

  } catch (err) {
    console.error("에러:", err);
  } finally {
    process.exit();
  }
}

updateStoreTypes();
