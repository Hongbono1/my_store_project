// db.js
console.log("🚨 PGHOST 확인:", process.env.PGHOST || "❌ 환경변수 적용 안 됨!");
console.log("🚨 PGPORT 확인:", process.env.PGPORT || "❌ 환경변수 적용 안 됨!");

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  ssl: {
    rejectUnauthorized: false,
  },
});

pool.connect((err, client, release) => {
  if (err) {
    console.error("❌ DB 연결 실패:", err);
  } else {
    console.log("✅ Supabase(PostgreSQL) DB 연결 성공!");
    release();
  }
});

module.exports = pool;

// 마지막 테스트 줄
