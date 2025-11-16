import pool from "./db.js";

async function initPerformingArtsTable() {
  try {
    // 1) 메인 테이블
    await pool.query(`
      CREATE TABLE IF NOT EXISTS performing_arts (
        id SERIAL PRIMARY KEY,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE,
        time VARCHAR(100),
        venue VARCHAR(255),
        address TEXT,
        description TEXT NOT NULL,
        price VARCHAR(100),
        host VARCHAR(255),
        age_limit VARCHAR(50),
        capacity INTEGER,
        tags TEXT,
        social1 TEXT,
        social2 TEXT,
        social3 TEXT,
        booking_url TEXT,
        phone VARCHAR(50),
        main_img TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("✅ performing_arts 테이블 준비 완료");

    // 2) 이미지/팜플렛 테이블
    await pool.query(`
      CREATE TABLE IF NOT EXISTS performing_arts_files (
        id SERIAL PRIMARY KEY,
        art_id INTEGER REFERENCES performing_arts(id) ON DELETE CASCADE,
        file_type VARCHAR(20) NOT NULL,
        file_path TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("✅ performing_arts_files 테이블 준비 완료");

  } catch (err) {
    console.error("❌ 테이블 생성 오류:", err);
  }
}

initPerformingArtsTable();
