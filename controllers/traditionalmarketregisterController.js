import pool from "../db.js";

export async function createTraditionalMarket(req, res) {
  try {
    const {
      market_name,
      address,
      phone,
      opening_hours,
      main_products,
      event_info,
      facilities,
      parking_available,
      transport_info,
      free_pr,
      qa_mode,
    } = req.body;

    // JSON 파싱
    const qa_list = req.body.qa_list ? JSON.parse(req.body.qa_list) : [];

    const main_img = req.files["main_img"]?.[0]?.filename || null;
    const parking_img = req.files["parking_img"]?.[0]?.filename || null;
    const transport_img = req.files["transport_img"]?.[0]?.filename || null;

    // 1) 기본 정보 INSERT
    const result = await pool.query(
      `
      INSERT INTO traditional_market
      (market_name, address, main_img, phone, opening_hours, main_products, 
       event_info, facilities, parking_available, parking_img, transport_info,
       transport_img, free_pr, qa_mode, qa_list)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      RETURNING id
      `,
      [
        market_name,
        address,
        main_img ? `/uploads/traditionalmarket/${main_img}` : null,
        phone,
        opening_hours,
        main_products,
        event_info,
        facilities,
        parking_available,
        parking_img ? `/uploads/traditionalmarket/${parking_img}` : null,
        transport_info,
        transport_img ? `/uploads/traditionalmarket/${transport_img}` : null,
        free_pr,
        qa_mode,
        JSON.stringify(qa_list)
      ]
    );

    const newId = result.rows[0].id;

    // 2) 서브 이미지 INSERT
    const subImgs = req.files["images"] || [];

    for (const file of subImgs) {
      await pool.query(
        `INSERT INTO traditional_market_images (market_id, img_path)
         VALUES ($1, $2)`,
        [newId, `/uploads/traditionalmarket/${file.filename}`]
      );
    }

    return res.json({ success: true, id: newId });
  } catch (err) {
    console.error("MARKET REGISTER ERROR:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
