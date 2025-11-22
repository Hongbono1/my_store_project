import pool from "../db.js";

/**
 * 동네 활동 점수 추가
 * @param {string} town_name - 동네 이름 (예: "경기 의정부시 가능동")
 * @param {number} points - 추가할 점수 (결제=5, 글쓰기=1, 좋아요=0.5 등)
 */
export async function addTownScore(town_name, points) {
  if (!town_name || !points) return;

  try {
    // 1. 기존 점수 업데이트
    await pool.query(
      `UPDATE town_activity
       SET raw_score = raw_score + $1,
           updated_at = NOW()
       WHERE town_name = $2`,
      [points, town_name]
    );

    // 2. 없으면 신규 생성
    await pool.query(
      `INSERT INTO town_activity (town_name, raw_score)
       VALUES ($1, $2)
       ON CONFLICT (town_name) DO NOTHING`,
      [town_name, points]
    );

    console.log(`✅ [동네점수] ${town_name}: +${points}점`);
  } catch (e) {
    console.error("❌ 동네 점수 업데이트 오류:", e);
  }
}

/**
 * 인구 보정 정규화 점수 갱신
 * 20분마다 실행 (Cron에서 호출)
 */
export async function normalizeScores() {
  try {
    const { rows: towns } = await pool.query(`
      SELECT ta.town_name, ta.raw_score, COALESCE(tp.population, 1000) as population
      FROM town_activity ta
      LEFT JOIN town_population tp
      ON ta.town_name = tp.town_name
    `);

    for (const t of towns) {
      const normalized = (t.raw_score / t.population) * 1000;

      await pool.query(
        `UPDATE town_activity
         SET score_normalized = $1
         WHERE town_name = $2`,
        [normalized, t.town_name]
      );
    }

    console.log(`✅ [정규화] ${towns.length}개 동네 점수 갱신 완료`);
  } catch (e) {
    console.error("❌ 정규화 오류:", e);
  }
}
