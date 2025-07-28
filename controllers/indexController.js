import pool from "../db.js";

// 조회수 높은 순으로 최대 8개만 응답
export async function getHotNeighborhoodAds(req, res) {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM hot_neighborhood ORDER BY views DESC, created_at DESC LIMIT 8"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ success: false, error: "DB Error", detail: err.message });
  }
}
