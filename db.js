console.log("🚨 PGHOST:", process.env.PGHOST || "❌ 적용 안됨");

const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  ssl: { rejectUnauthorized: false },
});

pool.connect((err, client, release) => {
  if (err) {
    console.error("❌ DB 연결 실패:", err);
  } else {
    console.log("✅ DB 연결 성공!");
    release();
  }
});

module.exports = pool;
