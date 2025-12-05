import pool from "./db.js";

async function initAdSlotsTable() {
  try {
    console.log("📋 admin_ad_slots 테이블 확인 중...");

    // 1. 테이블 존재 여부 확인
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'admin_ad_slots'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      // 2. 테이블이 없으면 생성
      console.log("📝 admin_ad_slots 테이블 생성 중...");
      
      await pool.query(`
        CREATE TABLE admin_ad_slots (
          id SERIAL PRIMARY KEY,
          page VARCHAR(100) NOT NULL,
          position VARCHAR(100) NOT NULL,
          slot_type VARCHAR(50) DEFAULT 'image',
          image_url TEXT,
          link_url TEXT,
          text_content TEXT,
          slot_mode VARCHAR(50) DEFAULT 'admin',
          store_id INTEGER,
          business_no VARCHAR(20),
          business_name VARCHAR(255),
          start_date DATE,
          end_date DATE,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(page, position)
        );

        CREATE INDEX idx_ad_slots_page_position 
        ON admin_ad_slots(page, position);
      `);

      console.log("✅ admin_ad_slots 테이블 생성 완료");
    } else {
      // 3. 테이블이 있으면 컬럼 확인 및 추가
      console.log("✅ admin_ad_slots 테이블이 존재합니다.");
      
      const columns = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'admin_ad_slots'
      `);

      const columnNames = columns.rows.map(r => r.column_name);
      console.log("📋 기존 컬럼:", columnNames.join(", "));

      // slot_type 컬럼이 없으면 추가
      if (!columnNames.includes('slot_type')) {
        console.log("➕ slot_type 컬럼 추가 중...");
        await pool.query(`
          ALTER TABLE admin_ad_slots 
          ADD COLUMN slot_type VARCHAR(50) DEFAULT 'image'
        `);
        console.log("✅ slot_type 컬럼 추가 완료");
      }

      // 다른 필수 컬럼들도 체크
      const requiredColumns = {
        slot_mode: "VARCHAR(50) DEFAULT 'admin'",
        store_id: "INTEGER",
        business_no: "VARCHAR(20)",
        business_name: "VARCHAR(255)",
        start_date: "DATE",
        end_date: "DATE"
      };

      for (const [colName, colType] of Object.entries(requiredColumns)) {
        if (!columnNames.includes(colName)) {
          console.log(`➕ ${colName} 컬럼 추가 중...`);
          await pool.query(`
            ALTER TABLE admin_ad_slots 
            ADD COLUMN ${colName} ${colType}
          `);
          console.log(`✅ ${colName} 컬럼 추가 완료`);
        }
      }
    }

    // 4. 인덱스 확인 및 생성
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_ad_slots_page_position 
      ON admin_ad_slots(page, position)
    `);

    console.log("\n✅ 테이블 초기화 완료!");
    console.log("📊 현재 스키마:");
    
    const finalSchema = await pool.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns 
      WHERE table_name = 'admin_ad_slots'
      ORDER BY ordinal_position
    `);

    console.table(finalSchema.rows);

    process.exit(0);
  } catch (err) {
    console.error("❌ 테이블 초기화 오류:", err.message);
    console.error(err);
    process.exit(1);
  }
}

initAdSlotsTable();