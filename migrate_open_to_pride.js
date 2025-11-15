// migrate_open_to_pride.js
// 사용법: node -r dotenv/config migrate_open_to_pride.js <open_id>
import pool from "./db.js";

async function main() {
  const arg = process.argv[2];
  const openId = Number(arg);
  if (!openId) {
    console.error("사용법: node -r dotenv/config migrate_open_to_pride.js <open_id>");
    process.exit(1);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 이미 해당 id로 store_pride가 존재하는지 확인
    const exists = await client.query("SELECT 1 FROM store_pride WHERE id=$1", [openId]);
    if (exists.rowCount > 0) {
      console.log(`store_pride에 id=${openId} 레코드가 이미 존재합니다.`);
      await client.query("ROLLBACK");
      return;
    }

    // open_stores에서 소스 데이터 조회
    const open = await client.query(
      `SELECT id, store_name, category, phone, address, image_path, description
       FROM open_stores WHERE id=$1`,
      [openId]
    );
    if (open.rowCount === 0) {
      console.error(`open_stores에 id=${openId} 레코드가 없습니다.`);
      await client.query("ROLLBACK");
      process.exit(2);
    }

    const row = open.rows[0];

    // store_pride에 동일 id로 삽입 (qa_mode는 임시로 'fixed')
    const insertSql = `
      INSERT INTO store_pride
        (id, store_name, category, phone, address, main_img, free_pr, qa_mode)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING id
    `;
    const { rows } = await client.query(insertSql, [
      row.id,
      row.store_name,
      row.category || null,
      row.phone || null,
      row.address || null,
      row.image_path || null,
      row.description || null, // description을 free_pr로 복사
      "fixed",
    ]);

    const prideId = rows[0].id;

    // 시퀀스 증가치 보정
    const seq = await client.query(
      "SELECT pg_get_serial_sequence('store_pride','id') AS seq"
    );
    const seqName = seq.rows[0]?.seq;
    if (seqName) {
      await client.query(
        `SELECT setval($1, GREATEST((SELECT COALESCE(MAX(id),1) FROM store_pride), nextval($1)))`,
        [seqName]
      );
    }

    await client.query("COMMIT");
    console.log(`✅ 이관 완료: open_stores(${openId}) -> store_pride(${prideId})`);
    console.log(`이제 /api/storeprideregister/${prideId} 또는 /storepridedetail.html?id=${prideId}`);
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("❌ 이관 중 오류:", e.message);
    process.exit(3);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
