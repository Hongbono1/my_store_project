// fix_combined_menu_unique.js
// Neon DB에 combined_menu_items 테이블 UNIQUE 제약조건 변경
// (store_id, name) → (store_id, category, name)
import pool from "./db.js";

async function fixUniqueConstraint() {
  const client = await pool.connect();
  try {
    console.log("✅ Neon DB 연결 성공");

    // 1. 현재 테이블 구조 확인
    console.log("\n=== 1. 테이블 구조 확인 ===");
    const { rows: columns } = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'combined_menu_items' 
      ORDER BY ordinal_position
    `);
    console.table(columns);

    // 2. 기존 제약조건 확인
    console.log("\n=== 2. 기존 제약조건 확인 ===");
    const { rows: constraints } = await client.query(`
      SELECT 
        con.conname AS constraint_name,
        con.contype AS constraint_type,
        pg_get_constraintdef(con.oid) AS constraint_definition
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      WHERE rel.relname = 'combined_menu_items'
    `);
    console.table(constraints);

    // 3. category NULL 체크
    console.log("\n=== 3. category NULL 데이터 확인 ===");
    const { rows: nullCats } = await client.query(`
      SELECT COUNT(*) as null_count
      FROM combined_menu_items
      WHERE category IS NULL OR btrim(category) = ''
    `);
    console.log(`NULL 또는 빈 category: ${nullCats[0].null_count}건`);

    if (parseInt(nullCats[0].null_count) > 0) {
      console.log("\n🔧 NULL/빈 category를 '기타'로 정리 중...");
      const { rowCount } = await client.query(`
        UPDATE combined_menu_items
        SET category = '기타'
        WHERE category IS NULL OR btrim(category) = ''
      `);
      console.log(`✅ ${rowCount}개의 category 정리 완료`);
    }

    // 4. (store_id, category, name) 기준 중복 데이터 확인
    console.log("\n=== 4. 새 기준 중복 데이터 확인 (store_id, category, name) ===");
    const { rows: duplicates } = await client.query(`
      SELECT store_id, category, name, COUNT(*) as cnt
      FROM combined_menu_items
      GROUP BY store_id, category, name
      HAVING COUNT(*) > 1
      ORDER BY cnt DESC
    `);
    
    if (duplicates.length > 0) {
      console.log(`⚠️ 중복 데이터 ${duplicates.length}건 발견:`);
      console.table(duplicates);

      // 중복 데이터 삭제 (최신 것만 남김)
      console.log("\n🔧 중복 데이터 정리 중...");
      const { rowCount } = await client.query(`
        DELETE FROM combined_menu_items
        WHERE id NOT IN (
          SELECT MAX(id)
          FROM combined_menu_items
          GROUP BY store_id, category, name
        )
      `);
      console.log(`✅ ${rowCount}개의 중복 데이터 삭제 완료`);
    } else {
      console.log("✅ 중복 데이터 없음");
    }

    // 5. category를 NOT NULL로 변경
    console.log("\n=== 5. category 컬럼을 NOT NULL로 변경 ===");
    try {
      await client.query(`
        ALTER TABLE combined_menu_items
        ALTER COLUMN category SET NOT NULL
      `);
      console.log("✅ category NOT NULL 제약조건 추가 완료");
    } catch (err) {
      console.log("⚠️ category NOT NULL 설정 실패 (이미 설정되어 있을 수 있음):", err.message);
    }

    // 6. 기존 unique_store_menu 제약조건 삭제
    console.log("\n=== 6. 기존 UNIQUE 제약조건 삭제 ===");
    const hasOldConstraint = constraints.some(c => c.constraint_name === 'unique_store_menu');
    
    if (hasOldConstraint) {
      await client.query(`
        ALTER TABLE combined_menu_items
        DROP CONSTRAINT unique_store_menu
      `);
      console.log("✅ 기존 'unique_store_menu' 제약조건 삭제 완료");
    } else {
      console.log("⚠️ 기존 'unique_store_menu' 제약조건이 없습니다.");
    }

    // 7. 새로운 UNIQUE 제약조건 추가 (store_id, category, name)
    console.log("\n=== 7. 새로운 UNIQUE 제약조건 추가 ===");
    await client.query(`
      ALTER TABLE combined_menu_items 
      ADD CONSTRAINT unique_store_menu 
      UNIQUE (store_id, category, name)
    `);
    console.log("✅ UNIQUE 제약조건 'unique_store_menu (store_id, category, name)' 추가 완료");

    // 8. 제약조건 추가 확인
    console.log("\n=== 8. 제약조건 추가 확인 ===");
    const { rows: newConstraints } = await client.query(`
      SELECT 
        con.conname AS constraint_name,
        con.contype AS constraint_type,
        pg_get_constraintdef(con.oid) AS constraint_definition
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      WHERE rel.relname = 'combined_menu_items'
        AND con.conname = 'unique_store_menu'
    `);
    console.table(newConstraints);

    console.log("\n✅ 모든 작업 완료!");
    console.log("   UNIQUE 제약조건: (store_id, category, name)");
    console.log("   → 같은 가게 + 같은 메뉴명이라도 카테고리가 다르면 저장 가능!");

  } catch (err) {
    console.error("❌ 오류 발생:", err.message);
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

fixUniqueConstraint();
