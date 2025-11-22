import pool from "./db.js";

async function createShoppingTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS shopping_info (
        id SERIAL PRIMARY KEY,
        shop_name VARCHAR(255) NOT NULL,
        short_desc VARCHAR(500),
        full_desc TEXT,
        category VARCHAR(100),
        website VARCHAR(500),
        sns_instagram VARCHAR(500),
        sns_youtube VARCHAR(500),
        sns_blog VARCHAR(500),
        image_main VARCHAR(500),
        image_banner1 VARCHAR(500),
        image_banner2 VARCHAR(500),
        image_banner3 VARCHAR(500),
        image_best1 VARCHAR(500),
        image_best2 VARCHAR(500),
        image_best3 VARCHAR(500),
        image_best4 VARCHAR(500),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("✅ shopping_info 테이블 생성 완료");
    process.exit(0);
  } catch (error) {
    console.error("❌ 테이블 생성 실패:", error);
    process.exit(1);
  }
}

createShoppingTable();
