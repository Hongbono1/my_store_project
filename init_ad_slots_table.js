import pool from "./db.js";

async function initAdSlotsTable() {
  try {
    console.log("📋 admin_ad_slots 테이블 확인 중...");

    const tableCheck = await pool.query(` await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables nformation_schema.tables 
        WHERE table_name = 'admin_ad_slots'
      );
    `);

    if (!tableCheck.rows[0].exists) {    if (!tableCheck.rows[0].exists) {
      console.log("📝 admin_ad_slots 테이블 생성 중...");테이블 생성 중...");
      
      await pool.query(`
        CREATE TABLE admin_ad_slots (  CREATE TABLE admin_ad_slots (
          id SERIAL PRIMARY KEY,ARY KEY,
          page VARCHAR(100) NOT NULL,
          position VARCHAR(100) NOT NULL,NOT NULL,
          slot_type VARCHAR(50) DEFAULT 'image',LT 'image',
          image_url TEXT,
          link_url TEXT,
          text_content TEXT,XT,
          slot_mode VARCHAR(50) DEFAULT 'admin',HAR(50) DEFAULT 'admin',
          store_id INTEGER,
          business_no VARCHAR(20),
          business_name VARCHAR(255),CHAR(255),
          start_date DATE,
          end_date DATE,
          created_at TIMESTAMP DEFAULT NOW(),TAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),ESTAMP DEFAULT NOW(),
          UNIQUE(page, position)
        );

        CREATE INDEX idx_ad_slots_page_position EATE INDEX idx_ad_slots_page_position 
        ON admin_ad_slots(page, position);        ON admin_ad_slots(page, position);
      `);

      console.log("✅ admin_ad_slots 테이블 생성 완료");sole.log("✅ admin_ad_slots 테이블 생성 완료");
    } else {    } else {
      console.log("✅ 테이블 존재 - 컬럼 확인 중...");
      
      const columns = await pool.query(`l.query(`
        SELECT column_name 
        FROM information_schema.columns   FROM information_schema.columns 
        WHERE table_name = 'admin_ad_slots'ts'
      `);

      const columnNames = columns.rows.map(r => r.column_name);r => r.column_name);

      // 필수 컬럼 추가      // 필수 컬럼 추가
      const requiredColumns = {
        slot_type: "VARCHAR(50) DEFAULT 'image'",
        slot_mode: "VARCHAR(50) DEFAULT 'admin'",        slot_mode: "VARCHAR(50) DEFAULT 'admin'",
        store_id: "INTEGER",
        business_no: "VARCHAR(20)",
        business_name: "VARCHAR(255)",
        start_date: "DATE",,
        end_date: "DATE"
      };

      for (const [colName, colType] of Object.entries(requiredColumns)) {t.entries(requiredColumns)) {
        if (!columnNames.includes(colName)) { if (!columnNames.includes(colName)) {
          console.log(`➕ ${colName} 컬럼 추가 중...`);          console.log(`➕ ${colName} 컬럼 추가 중...`);
          await pool.query(`uery(`
            ALTER TABLE admin_ad_slots d_slots 
            ADD COLUMN ${colName} ${colType}
          `);
        }
      }
    }

    console.log("\n✅ 테이블 초기화 완료!");ole.log("\n✅ 테이블 초기화 완료!");
        
    const schema = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'admin_ad_slots'min_ad_slots'
      ORDER BY ordinal_position
    `);
    
    console.table(schema.rows);
    process.exit(0);ss.exit(0);
  } catch (err) {ch (err) {
    console.error("❌ 오류:", err.message);onsole.error("❌ 오류:", err.message);
    process.exit(1);    process.exit(1);
  }
}

initAdSlotsTable();