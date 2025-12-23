// fix_foodcategory_links.js
// ✅ 푸드카테고리 슬롯의 잘못된 link_url 수정 스크립트

import pool from "./db.js";

async function fixFoodCategoryLinks() {
  const client = await pool.connect();
  try {
    console.log("🔧 푸드카테고리 슬롯 링크 수정 시작...\n");

    // 1. store_info 테이블 가게들의 링크 수정
    console.log("1️⃣ store_info 테이블 링크 수정 중...");
    const result1 = await client.query(`
      UPDATE public.admin_ad_slots
      SET link_url = '/ndetail.html?id=' || store_id || '&type=store_info'
      WHERE page = 'foodcategory'
        AND table_source = 'store_info'
        AND store_id IS NOT NULL
        AND (
          link_url IS NULL 
          OR link_url = ''
          OR link_url LIKE '%type=combined%'
          OR link_url LIKE '%type=open%'
          OR link_url NOT LIKE '%type=%'
        )
      RETURNING id, position, store_id, business_name, link_url;
    `);
    console.log(`   ✅ ${result1.rowCount}개 수정됨`);
    if (result1.rows.length > 0) {
      result1.rows.forEach(row => {
        console.log(`      - [${row.position}] ${row.business_name} (id:${row.store_id}) → ${row.link_url}`);
      });
    }

    // 2. combined_store_info 테이블 가게들의 링크 수정
    console.log("\n2️⃣ combined_store_info 테이블 링크 수정 중...");
    const result2 = await client.query(`
      UPDATE public.admin_ad_slots
      SET link_url = '/ndetail.html?id=' || store_id || '&type=combined'
      WHERE page = 'foodcategory'
        AND table_source = 'combined_store_info'
        AND store_id IS NOT NULL
        AND (
          link_url IS NULL 
          OR link_url = ''
          OR link_url LIKE '%type=store_info%'
          OR link_url LIKE '%type=open%'
          OR link_url NOT LIKE '%type=%'
        )
      RETURNING id, position, store_id, business_name, link_url;
    `);
    console.log(`   ✅ ${result2.rowCount}개 수정됨`);
    if (result2.rows.length > 0) {
      result2.rows.forEach(row => {
        console.log(`      - [${row.position}] ${row.business_name} (id:${row.store_id}) → ${row.link_url}`);
      });
    }

    // 3. food_stores 테이블 가게들의 링크 수정
    console.log("\n3️⃣ food_stores 테이블 링크 수정 중...");
    const result3 = await client.query(`
      UPDATE public.admin_ad_slots
      SET link_url = '/ndetail.html?id=' || store_id || '&type=food'
      WHERE page = 'foodcategory'
        AND table_source = 'food_stores'
        AND store_id IS NOT NULL
        AND (
          link_url IS NULL 
          OR link_url = ''
          OR link_url NOT LIKE '%type=food%'
        )
      RETURNING id, position, store_id, business_name, link_url;
    `);
    console.log(`   ✅ ${result3.rowCount}개 수정됨`);
    if (result3.rows.length > 0) {
      result3.rows.forEach(row => {
        console.log(`      - [${row.position}] ${row.business_name} (id:${row.store_id}) → ${row.link_url}`);
      });
    }

    // 4. 결과 확인
    console.log("\n📊 수정 후 상태 확인:\n");
    const check = await client.query(`
      SELECT 
        id,
        position,
        priority,
        table_source,
        store_id,
        business_name,
        link_url,
        CASE 
          WHEN link_url LIKE '%type=store_info%' THEN '✅ store_info'
          WHEN link_url LIKE '%type=combined%' THEN '✅ combined'
          WHEN link_url LIKE '%type=food%' THEN '✅ food'
          ELSE '❌ 잘못된 링크'
        END as link_check
      FROM public.admin_ad_slots
      WHERE page = 'foodcategory'
        AND store_id IS NOT NULL
      ORDER BY position, priority;
    `);

    console.log(`총 ${check.rowCount}개의 슬롯:\n`);
    check.rows.forEach(row => {
      const pri = row.priority !== null ? `[${row.priority}]` : "";
      console.log(`${row.link_check} ${row.position}${pri} - ${row.business_name} (${row.table_source})`);
      console.log(`   ${row.link_url}\n`);
    });

    console.log("✅ 수정 완료!");
  } catch (err) {
    console.error("❌ 오류 발생:", err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

fixFoodCategoryLinks();
