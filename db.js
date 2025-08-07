// db.js
import { Pool } from "pg";
import dotenv from "dotenv";
dotenv.config();

const isNeon = process.env.DATABASE_URL?.includes("neon.tech");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isNeon ? { rejectUnauthorized: false } : false,
});

export default pool;