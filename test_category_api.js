import pool from "./db.js";

async function testCategoryAPI() {
  try {
    console.log("\n🔍 category 페이지 광고 데이터 확인\n");
    
    // 1. 데이터베이스에서 직접 조회
    const dbResult = await pool.query(`
      SELECT id, page, position, priority, business_name, image_url, store_type, store_id
      FROM admin_ad_slots 
      WHERE page = 'category' 
      ORDER BY position, priority
      LIMIT 20
    `);

    console.log(`📊 DB에 저장된 category 광고: ${dbResult.rows.length}개\n`);

    if (dbResult.rows.length === 0) {
      console.log("❌ 데이터베이스에 광고가 없습니다!");
      console.log("   관리자 페이지에서 저장이 안 되었을 수 있습니다.\n");
    } else {
      console.log("✅ 데이터베이스에 광고 데이터 존재:\n");
      
      const grouped = {};
      dbResult.rows.forEach(row => {
        if (!grouped[row.position]) grouped[row.position] = [];
        grouped[row.position].push(row);
      });

      for (const [pos, items] of Object.entries(grouped)) {
        console.log(`📍 ${pos}: ${items.length}개`);
        items.forEach(item => {
          console.log(`   [${item.priority}] ${item.business_name || '(빈슬롯)'}`);
          if (item.image_url) console.log(`       이미지: ${item.image_url.substring(0, 50)}...`);
          if (item.store_id) console.log(`       가게: ${item.store_type}#${item.store_id}`);
        });
        console.log("");
      }

      // 2. API 응답 시뮬레이션 (ncategory2managerAdController의 로직 확인)
      console.log("\n🔧 API 응답 테스트\n");
      console.log("프론트엔드가 호출하는 URL:");
      console.log("  GET /ncategory2manager/ad/slot-items?page=category\n");
      console.log("예상 응답 형식:");
      console.log("  { success: true, items: [...] }\n");
      
      console.log("💡 다음 단계:");
      console.log("  1. 브라우저에서 http://localhost:3000/ncategory2.html 열기");
      console.log("  2. F12 개발자 도구 열기");
      console.log("  3. Network 탭에서 'slot-items' 검색");
      console.log("  4. 응답 데이터 확인\n");
    }

    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error("❌ 에러:", err.message);
    process.exit(1);
  }
}

testCategoryAPI();
