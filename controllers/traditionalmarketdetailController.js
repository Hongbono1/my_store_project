import pool from "../db.js";

// 목록 조회
export async function getMarketList(req, res) {
  try {
    const result = await pool.query(
      `SELECT id, market_name, address, phone, main_img, event_info, facilities, parking_available, created_at 
       FROM traditional_market 
       ORDER BY created_at DESC`
    );

    return res.json(result.rows);
  } catch (err) {
    console.error("MARKET LIST ERROR:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

// 상세 조회
export async function getTraditionalMarketById(req, res) {
  try {
    const { id } = req.params;

    // 1) 메인 데이터 조회
    const result = await pool.query(
      `SELECT * FROM traditional_market WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "시장을 찾을 수 없습니다." });
    }

    const market = result.rows[0];

    // 2) 서브 이미지 조회
    const imagesResult = await pool.query(
      `SELECT img_path FROM traditional_market_images WHERE market_id = $1 ORDER BY id`,
      [id]
    );

    market.sub_images = imagesResult.rows.map(row => row.img_path);

    return res.json({ success: true, data: market });
  } catch (err) {
    console.error("MARKET DETAIL ERROR:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
