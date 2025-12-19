import pool from "./db.js";

async function debugBestPickData() {
  try {
    console.log("\n=== 베스트 픽 슬롯들 확인 ===");
    const bp = await pool.query(
      "SELECT * FROM admin_ad_slot_items WHERE page='index' AND position LIKE 'best_pick%' ORDER BY position"
    );
    console.log("베스트픽 슬롯들:", bp.rows);

    console.log("\n=== combined_store_info 확인 (사업자번호 포함) ===");
    const stores = await pool.query(
      "SELECT id, business_name, business_number FROM combined_store_info ORDER BY id"
    );
    console.log("가게 목록:");
    stores.rows.forEach(row => {
      console.log(`  ID: ${row.id}, 가게명: ${row.business_name}, 사업자: ${row.business_number}`);
    });

    console.log("\n=== combined_store_images 확인 ===");
    const images = await pool.query(
      "SELECT store_id, url FROM combined_store_images ORDER BY store_id"
    );
    console.log("이미지 목록:");
    images.rows.forEach(row => {
      console.log(`  store_id: ${row.store_id}, url: ${row.url}`);
    });



  } catch (err) {
    console.error("에러:", err);
  } finally {
    process.exit();
  }
}

debugBestPickData();
