// db.js
import pg from "pg";
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Neon/외부 PG 권장
});

// ── DB 연결 식별 로그 (부팅 시 1회)
(async () => {
  try {
    const r = await pool.query(`
      SELECT
        current_database()  AS db,
        current_user        AS usr,
        inet_server_addr()::text AS srv_addr,
        inet_server_port()       AS srv_port,
        inet_client_addr()::text AS cli_addr
    `);
    const row = r.rows[0];

    // DATABASE_URL을 안전하게 마스킹
    const raw = process.env.DATABASE_URL || "";
    const masked = raw.replace(/:\/\/([^:@]+):([^@]+)@/, (m, u, p) => `://${u}:*****@`);

    console.log("[db] using DATABASE_URL:", masked);
    console.log("[db] whoami:", {
      db: row.db,
      usr: row.usr,
      srv_addr: row.srv_addr, // 프록시/Neon은 null일 수도 있음
      srv_port: row.srv_port,
      cli_addr: row.cli_addr,
    });
  } catch (e) {
    console.error("[db] diag error:", e.message);
  }
})();

export default pool;
