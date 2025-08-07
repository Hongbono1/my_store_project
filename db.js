 import { Pool } from "pg";
 import "dotenv/config";

 const pool = new Pool({
   host:     process.env.PGHOST,
   port:     Number(process.env.PGPORT) || 5432,
   user:     process.env.PGUSER,
   password: process.env.PGPASSWORD,
   database: process.env.PGDATABASE,
   ssl:      { rejectUnauthorized: false },   // Neon TLS
 });

 export default pool;
