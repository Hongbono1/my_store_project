import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrateBannerPositions() {
  try {
    console.log("🔄 배너 position 마이그레이션 시작...");

    // 옛날 형식 → 새 형식 매핑
    const migrations = [
      { old: "subcategory_top__food", new: "subcategory|food|||top|1" },
      { old: "subcategory_top_banner__food", new: "subcategory|food|||top|1" },
      { old: "subcategory_top__combined", new: "subcategory|combined|||top|1" },
      { old: "subcategory_top_banner__combined", new: "subcategory|combined|||top|1" },
    ];

    for (const { old, new: newPos } of migrations) {
      const { rows } = await pool.query(
        `SELECT * FROM public.admin_ad_slots WHERE position = $1`,
        [old]
      );

      if (rows.length === 0) {
        console.log(`  ⏭️  건너뜀: ${old} (데이터 없음)`);
        continue;
      }

      console.log(`  📋 발견: ${old} (${rows.length}개 행)`);

      // 새 position으로 이미 데이터가 있으면 옛날 것 삭제
      const { rows: existing } = await pool.query(
        `SELECT * FROM public.admin_ad_slots WHERE position = $1`,
        [newPos]
      );

      if (existing.length > 0) {
        console.log(`  🗑️  삭제: ${old} (새 position에 이미 데이터 존재)`);
        await pool.query(
          `DELETE FROM public.admin_ad_slots WHERE position = $1`,
          [old]
        );
      } else {
        // 옛날 position을 새 position으로 업데이트
        console.log(`  ✅ 마이그레이션: ${old} → ${newPos}`);
        await pool.query(
          `UPDATE public.admin_ad_slots SET position = $1, updated_at = NOW() WHERE position = $2`,
          [newPos, old]
        );
      }
    }

    console.log("✅ 마이그레이션 완료!");
    await pool.end();
  } catch (err) {
    console.error("❌ 마이그레이션 실패:", err.message);
    console.error(err);
    process.exit(1);
  }
}

migrateBannerPositions();
