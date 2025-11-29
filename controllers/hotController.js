// controllers/hotController.js
import pool from "../db.js";

/**
 * HOT 랭킹 요약
 * - 많이 찾아본 가게: click_rank 1~5
 * - 많이 찜한 가게: bookmark_rank 1~5
 * - 오늘의 추천 가게: click_rank 6~10
 * - 주목받는 가게: click_rank 11~15
 *
 * 응답: { ok, mostViewed, mostBookmarked, todayPick, rising }
 */
export async function getHotSummary(req, res) {
  try {
    const { rows } = await pool.query(`
      WITH ranked AS (
        SELECT
          s.id,
          s.business_name,
          s.business_category,
          COALESCE(h.click_count, 0)    AS click_count,
          COALESCE(h.bookmark_count, 0) AS bookmark_count,
          ROW_NUMBER() OVER (
            ORDER BY COALESCE(h.click_count, 0) DESC, s.id
          ) AS click_rank,
          ROW_NUMBER() OVER (
            ORDER BY COALESCE(h.bookmark_count, 0) DESC, s.id
          ) AS bookmark_rank
        FROM store_info AS s                -- 🔴 실제 가게 테이블명으로 변경
        LEFT JOIN hotplace_stats AS h       -- 🔴 클릭/북마크 통계 테이블명
          ON h.store_id = s.id              -- 🔴 PK 컬럼명에 맞게 수정
      )
      SELECT * FROM ranked;
    `);

    const mostViewed = rows.filter(r => r.click_rank >= 1 && r.click_rank <= 5);
    const mostBookmarked = rows.filter(r => r.bookmark_rank >= 1 && r.bookmark_rank <= 5);
    const todayPick = rows.filter(r => r.click_rank >= 6 && r.click_rank <= 10);
    const rising = rows.filter(r => r.click_rank >= 11 && r.click_rank <= 15);

    res.json({
      ok: true,
      mostViewed,
      mostBookmarked,
      todayPick,
      rising,
    });
  } catch (err) {
    console.error("HOT SUMMARY ERROR:", err);
    res.status(500).json({ ok: false, error: "server_error" });
  }
}
