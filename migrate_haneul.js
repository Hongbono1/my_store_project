import pg from "pg";
const { Pool } = pg;

const DATABASE_URL = "postgresql://neondb_owner:npg_bQq0phW8nwJk@ep-yellow-wind-a1j52vje-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrateHaneul() {
  try {
    console.log("하늘식당 마이그레이션 시작...\n");

    // 1. store_info에서 하늘식당 데이터 확인
    const storeInfo = await pool.query(`
      SELECT * FROM store_info WHERE id = 1
    `);
    
    if (storeInfo.rows.length === 0) {
      console.log("❌ store_info에 하늘식당이 없습니다.");
      return;
    }
    
    const store = storeInfo.rows[0];
    console.log("✅ store_info에서 발견:");
    console.log(`   ID: ${store.id}`);
    console.log(`   상호명: ${store.business_name}`);
    console.log(`   사업자번호: ${store.business_number}`);
    console.log(`   업종: ${store.business_category}\n`);

    // 2. combined_store_info에 이미 존재하는지 확인
    const existing = await pool.query(`
      SELECT id FROM combined_store_info 
      WHERE business_number = $1
    `, [store.business_number]);
    
    if (existing.rows.length > 0) {
      console.log(`⚠️ 이미 combined_store_info에 존재합니다 (ID: ${existing.rows[0].id})`);
      const newId = existing.rows[0].id;
      
      // 광고 슬롯 업데이트
      await pool.query(`
        UPDATE admin_ad_slots 
        SET store_id = $1
        WHERE page = 'foodcategory' AND position = 'food_power_7'
      `, [newId]);
      
      console.log(`✅ 광고 슬롯의 store_id를 ${newId}로 업데이트했습니다.`);
      return;
    }

    // 3. combined_store_info에 INSERT
    const insertResult = await pool.query(`
      INSERT INTO combined_store_info (
        business_name,
        business_number,
        business_type,
        business_category,
        business_subcategory,
        address,
        detail_address,
        phone,
        created_at
      ) VALUES (
        $1,  -- business_name
        $2,  -- business_number
        $3,  -- business_type (한식)
        $4,  -- business_category
        '',  -- business_subcategory
        COALESCE($5, ''),  -- address
        '',  -- detail_address
        COALESCE($6, ''),  -- phone
        NOW()
      )
      RETURNING id
    `, [
      store.business_name,
      store.business_number,
      '한식',  // business_type
      store.business_category || '한식',  // business_category
      store.address,
      store.phone
    ]);

    const newId = insertResult.rows[0].id;
    console.log(`\n✅ combined_store_info에 추가 완료 (새 ID: ${newId})`);

    // 4. 광고 슬롯의 store_id 업데이트
    const updateResult = await pool.query(`
      UPDATE admin_ad_slots 
      SET store_id = $1
      WHERE page = 'foodcategory' AND position = 'food_power_7'
      RETURNING id, position, store_id, business_name
    `, [newId]);

    if (updateResult.rows.length > 0) {
      console.log(`✅ 광고 슬롯 업데이트 완료:`);
      console.log(`   슬롯 ID: ${updateResult.rows[0].id}`);
      console.log(`   위치: ${updateResult.rows[0].position}`);
      console.log(`   Store ID: ${updateResult.rows[0].store_id}`);
      console.log(`   상호명: ${updateResult.rows[0].business_name}`);
    }

    // 5. 검증
    console.log("\n=== 최종 검증 ===");
    const verify = await pool.query(`
      SELECT 
        s.position,
        s.store_id,
        s.business_name as slot_name,
        c.business_name as store_name,
        c.business_type,
        c.business_category
      FROM admin_ad_slots s
      LEFT JOIN combined_store_info c ON s.store_id::text = c.id::text
      WHERE s.page = 'foodcategory' AND s.position = 'food_power_7'
    `);

    if (verify.rows.length > 0) {
      const v = verify.rows[0];
      console.log(`위치: ${v.position}`);
      console.log(`Store ID: ${v.store_id}`);
      console.log(`상호명: ${v.store_name}`);
      console.log(`업종: ${v.business_type}`);
      console.log(`카테고리: ${v.business_category}`);
      console.log("\n✅ 마이그레이션 완료! 이제 '하늘식당'이 '한식'으로 표시됩니다.");
    }

  } catch (error) {
    console.error("❌ 에러:", error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

migrateHaneul();
