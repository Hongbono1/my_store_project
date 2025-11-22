import pool from "./db.js";

async function addSnsOtherColumn() {
  try {
    await pool.query(`
      ALTER TABLE shopping_info 
      ADD COLUMN IF NOT EXISTS sns_other VARCHAR(500)
    `);
    console.log("✅ sns_other 컬럼 추가 완료");
    process.exit(0);
  } catch (error) {
    console.error("❌ 컬럼 추가 실패:", error);
    process.exit(1);
  }
}

addSnsOtherColumn();
