import { pool } from "../db/pool.js";

/** 단일 시장 조회 */
export async function getSubmarketById(req, res) {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT * FROM market_info WHERE id = $1`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: "Not found" });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "조회 오류" });
  }
}

/** 목록 조회 (필요 시) */
export async function getSubmarketList(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT id, market_name, address, main_img FROM market_info ORDER BY id DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "목록 조회 오류" });
  }
}
