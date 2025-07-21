import { pool } from "../db/pool.js";

export async function createMarket(req, res) {
  try {
    const {
      market_name, address, phone, opening_hours, main_products,
      event_info, facilities, parking_available, transport_info,
      qa_mode, free_pr
    } = req.body;
    // 파일 경로
    const main_img = req.files["main_img"] ? "/uploads/" + req.files["main_img"][0].filename : null;
    const parking_img = req.files["parking_img"] ? "/uploads/" + req.files["parking_img"][0].filename : null;
    const transport_img = req.files["transport_img"] ? "/uploads/" + req.files["transport_img"][0].filename : null;
    
    // INSERT 쿼리
    const sql = `
      INSERT INTO market_info
        (market_name, address, main_img, phone, opening_hours, main_products, event_info, facilities, parking_available, parking_img, transport_info, transport_img, qa_mode, free_pr)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING id
    `;
    const values = [
      market_name, address, main_img, phone, opening_hours, main_products,
      event_info, facilities, parking_available, parking_img, transport_info,
      transport_img, qa_mode, free_pr
    ];

    const { rows } = await pool.query(sql, values);
    res.json({ success: true, id: rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "등록 오류" });
  }
}
