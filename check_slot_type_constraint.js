import pool from "./db.js";

async function checkConstraint() {
  try {
    // 제약 조건 확인
    const { rows } = await pool.query(`
      SELECT 
        conname,
        pg_get_constraintdef(oid) as definition
      FROM pg_constraint 
      WHERE conrelid = 'public.admin_ad_slots'::regclass
        AND contype = 'c'
    `);
    
    console.log("✅ Check constraints:");
    rows.forEach(r => {
      console.log(`  ${r.conname}: ${r.definition}`);
    });

    // 현재 데이터 샘플 확인
    const { rows: samples } = await pool.query(`
      SELECT DISTINCT slot_type 
      FROM public.admin_ad_slots 
      WHERE slot_type IS NOT NULL
      LIMIT 10
    `);
    
    console.log("\n✅ Existing slot_type values:");
    samples.forEach(s => console.log(`  - ${s.slot_type}`));

    await pool.end();
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

checkConstraint();
