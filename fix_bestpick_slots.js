import pool from "./db.js";

async function fixBestPickSlots() {
  try {
    console.log("\n=== 베스트 픽 슬롯 수정 ===");

    // 베스트 픽 1 (라인헤어) - 올바른 이미지로 업데이트
    console.log("\n1. 베스트 픽 1 (라인헤어) 이미지 수정...");
    await pool.query(`
      UPDATE admin_ad_slot_items
      SET image_url = '/uploads/dc8b5096-30d0-4a5d-b2a5-cddb4d619e5b.jpg'
      WHERE page = 'index' 
        AND position = 'best_pick_1'
        AND business_no = '0000000001'
    `);
    console.log("✅ 라인헤어 이미지 업데이트 완료");

    // 베스트 픽 2 (하늘식당) - 올바른 링크로 업데이트
    console.log("\n2. 베스트 픽 2 (하늘식당) 링크 수정...");
    await pool.query(`
      UPDATE admin_ad_slot_items
      SET link_url = '/ndetail.html?biz=2910802895&type=store_info'
      WHERE page = 'index' 
        AND position = 'best_pick_2'
        AND business_no = '2910802895'
    `);
    console.log("✅ 하늘식당 링크 업데이트 완료");

    console.log("\n=== 수정 후 상태 확인 ===");
    const result = await pool.query(`
      SELECT position, business_no, business_name, link_url, image_url
      FROM admin_ad_slot_items
      WHERE page = 'index' AND position LIKE 'best_pick%'
      ORDER BY position
    `);

    result.rows.forEach(row => {
      console.log(`\n[${row.position}]`);
      console.log(`  가게: ${row.business_name} (${row.business_no})`);
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

fixBestPickSlots();
