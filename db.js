// db.js
import pg from "pg";
const { Pool } = pg;

// .env: DATABASE_URL=postgresql://user:pass@host:port/dbname
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Neon 권장
});

export default pool;