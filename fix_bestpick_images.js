import pool from "./db.js";

async function fixBestPickImages() {
  try {
    console.log("\n=== 베스트 픽 이미지 수동 갱신 ===");

    // 베스트 픽 슬롯들의 image_url을 NULL로 설정하여 attachAutoStoreImage가 다시 조회하도록 트리거
    const updateResult = await pool.query(`
      UPDATE admin_ad_slot_items
      SET image_url = NULL
      WHERE page = 'index' 
        AND position LIKE 'best_pick%'
        AND slot_mode = 'store'
      RETURNING position, business_no, business_name
    `);

    console.log("업데이트된 슬롯:", updateResult.rows);

    console.log("\n✅ 완료! 이제 서버를 재시작하거나 인덱스 페이지를 새로고침하면 자동으로 올바른 이미지가 로드됩니다.");

  } catch (err) {
    console.error("에러:", err);
  } finally {
    process.exit();
  }
}

fixBestPickImages();
