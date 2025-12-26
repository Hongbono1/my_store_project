import pool from "./db.js";

async function fixNCategoryAds() {
  try {
    // 1. 현재 상태 확인
    console.log("\n📊 현재 광고 데이터 확인\n");
    
    const all = await pool.query(`
      SELECT id, page, position, priority, business_name
      FROM admin_ad_slots 
      ORDER BY page, position, priority
      LIMIT 50
    `);

    console.log(`전체 광고: ${all.rows.length}개\n`);
    
    const grouped = {};
    all.rows.forEach(row => {
      if (!grouped[row.page]) grouped[row.page] = [];
      grouped[row.page].push(row);
    });

    for (const [page, items] of Object.entries(grouped)) {
      console.log(`\n📄 page="${page}": ${items.length}개`);
      items.forEach(item => {
        console.log(`   [${item.position}:${item.priority}] ${item.business_name || '(빈슬롯)'}`);
      });
    }

    // 2. ncategory2 페이지 광고 확인
    const ncategory2Ads = await pool.query(`
      SELECT * FROM admin_ad_slots WHERE page = 'ncategory2'
    `);

    console.log(`\n\n🎯 page="ncategory2" 광고: ${ncategory2Ads.rows.length}개\n`);

    if (ncategory2Ads.rows.length === 0) {
      console.log("⚠️  ncategory2 페이지에 광고가 없습니다!\n");
      console.log("💡 해결 방법:\n");
      console.log("옵션 1: 관리자 페이지에서 새로 등록");
      console.log("  → http://localhost:3000/admin/ncategory2manager.html");
      console.log("  → page: ncategory2");
      console.log("  → position: ncategory2_power, ncategory2_mvp 등\n");

      // 3. 다른 페이지 광고가 있는지 확인
      const similarPages = all.rows.filter(r => 
        r.page && (r.page.includes('category') || r.page.includes('ncategory'))
      );

      if (similarPages.length > 0) {
        console.log("📋 비슷한 페이지 이름의 광고 발견:\n");
        similarPages.forEach(r => {
          console.log(`   ID ${r.id}: page="${r.page}" position="${r.position}" priority=${r.priority}`);
        });
        console.log("\n옵션 2: 기존 광고의 page를 ncategory2로 변경");
        console.log("  → 위 ID 중 하나를 선택해서 알려주세요\n");
      }
    } else {
      console.log("✅ ncategory2 광고가 존재합니다:");
      ncategory2Ads.rows.forEach(r => {
        console.log(`   [${r.position}:${r.priority}] ${r.business_name || '(빈슬롯)'}`);
      });
    }

    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error("❌ 에러:", err.message);
    console.error(err);
    process.exit(1);
  }
}

fixNCategoryAds();
