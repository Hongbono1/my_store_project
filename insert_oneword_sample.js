import pool from "./db.js";

async function insertSampleData() {
  try {
    const region = "의정부";

    // 검색 로그 샘플 (최근 30분)
    const searches = ["치킨", "피자", "족발", "치킨", "치킨", "떡볶이", "피자"];
    for (const keyword of searches) {
      await pool.query(`
        INSERT INTO search_logs (region, keyword, created_at)
        VALUES ($1, $2, NOW() - INTERVAL '${Math.floor(Math.random() * 30)} minutes')
      `, [region, keyword]);
    }
    console.log("✅ 검색 로그 샘플 데이터 삽입 완료");

    // 메뉴 클릭 로그 샘플
    const menus = ["양념치킨", "후라이드", "양념치킨", "고추바사삭", "양념치킨"];
    for (const menu_name of menus) {
      await pool.query(`
        INSERT INTO menu_click_logs (region, menu_name, created_at)
        VALUES ($1, $2, NOW() - INTERVAL '${Math.floor(Math.random() * 30)} minutes')
      `, [region, menu_name]);
    }
    console.log("✅ 메뉴 클릭 로그 샘플 데이터 삽입 완료");

    // 조회수 로그 샘플
    const storeIds = [1, 2, 1, 3, 1, 1, 2];
    for (const store_id of storeIds) {
      await pool.query(`
        INSERT INTO view_logs (region, store_id, created_at)
        VALUES ($1, $2, NOW() - INTERVAL '${Math.floor(Math.random() * 30)} minutes')
      `, [region, store_id]);
    }
    console.log("✅ 조회수 로그 샘플 데이터 삽입 완료");

    // 결과 확인
    const searchResult = await pool.query(`
      SELECT keyword, COUNT(*) as cnt
      FROM search_logs
      WHERE region = $1 AND created_at > NOW() - INTERVAL '1 hour'
      GROUP BY keyword
      ORDER BY cnt DESC
      LIMIT 1
    `, [region]);

    console.log("\n📊 현재 인기 검색어:", searchResult.rows[0]);

    const menuResult = await pool.query(`
      SELECT menu_name, COUNT(*) as cnt
      FROM menu_click_logs
      WHERE region = $1 AND created_at > NOW() - INTERVAL '1 hour'
      GROUP BY menu_name
      ORDER BY cnt DESC
      LIMIT 1
    `, [region]);

    console.log("📊 현재 인기 메뉴:", menuResult.rows[0]);

    console.log("\n🎉 샘플 데이터 삽입 완료!");
    process.exit(0);
  } catch (error) {
    console.error("❌ 샘플 데이터 삽입 실패:", error);
    process.exit(1);
  }
}

insertSampleData();
