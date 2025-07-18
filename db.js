// db.js
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from "dotenv";
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // .env에 반드시 DATABASE_URL 작성!
  ssl: {
    rejectUnauthorized: false
  }
});

export default pool;