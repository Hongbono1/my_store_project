import { Pool } from "pg";
import dotenv from "dotenv";
dotenv.config();

export const pool = new Pool({
  host:     process.env.PGHOST,
  port:     Number(process.env.PGPORT) || 5432,
  user:     process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  ssl:      { rejectUnauthorized: false },   // Neon's serverless SSL
});
export default pool;
