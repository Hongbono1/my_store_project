import pool from "../db.js";

// 전국 Top 10 동네 조회
export async function getTop10(req, res) {
  try {
    const { rows } = await pool.query(`
      SELECT town_name
      FROM town_activity
      ORDER BY score_normalized DESC
      LIMIT 10
    `);

    res.json(rows);
  } catch (error) {
    console.error("❌ Top10 조회 오류:", error);
    res.status(500).json({ success: false, error: "랭킹 조회 오류" });
  }
}

// 내 동네 순위 조회
export async function getMyTownRank(req, res) {
  const { town } = req.query;

  if (!town) {
    return res.status(400).json({ success: false, error: "town 파라미터 필요" });
  }

  try {
    const { rows: ranked } = await pool.query(`
      SELECT town_name
      FROM town_activity
      ORDER BY score_normalized DESC
    `);

    let rank = ranked.findIndex(r => r.town_name === town);
    if (rank === -1) {
      rank = null;
    } else {
      rank = rank + 1; // 1등부터 시작
    }

    res.json({
      town,
      rank,
      total_town: ranked.length
    });
  } catch (error) {
    console.error("❌ 내 동네 순위 조회 오류:", error);
    res.status(500).json({ success: false, error: "순위 조회 오류" });
  }
}
