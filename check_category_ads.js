import pool from "./db.js";

async function checkCategoryAds() {
  try {
    const result = await pool.query(`
      SELECT page, position, priority, business_name, store_type, store_id
      FROM admin_ad_slots 
      WHERE page = 'category' 
      ORDER BY position, priority
    `);

    console.log(`\n📊 category 페이지 광고 슬롯: ${result.rows.length}개\n`);

    if (result.rows.length === 0) {
      console.log("⚠️  등록된 광고가 없습니다!");
      console.log("\n💡 해결 방법:");
      console.log("   1. 브라우저에서 /admin/ncategory2manager.html 열기");
      console.log("   2. 슬롯 추가 버튼 클릭");
      console.log("   3. page: category");
      console.log("   4. position: category_power, category_mvp, category_highlight, category_best");
      console.log("   5. 가게 또는 이미지 선택 후 저장\n");
    } else {
      result.rows.forEach(row => {
        const name = row.business_name || "(빈 슬롯)";
        console.log(`  ✅ ${row.position} [우선순위: ${row.priority}]`);
        console.log(`     ${name}`);
        if (row.store_type && row.store_id) {
          console.log(`     store: ${row.store_type}#${row.store_id}`);
        }
        console.log("");
      });
    }

    process.exit(0);
  } catch (err) {
    console.error("❌ 에러:", err.message);
    process.exit(1);
  }
}

checkCategoryAds();
