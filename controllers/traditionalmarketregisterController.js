import pool from "../db.js";

const URL_PREFIX = "/uploads/traditionalmarket";

export async function createTraditionalMarket(req, res) {
  try {
    console.log("📦 받은 파일들:", req.files);
    console.log("📝 받은 데이터:", req.body);

    const {
      market_name,
      address,
      lat,
      lng,
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

    // ✅ JSON 파싱 안전 처리
    let qa_list = [];
    if (req.body.qa_list) {
      try {
        qa_list = JSON.parse(req.body.qa_list);
        if (!Array.isArray(qa_list)) qa_list = [];
      } catch (e) {
        console.warn("⚠️ qa_list JSON 파싱 실패 - 빈 배열로 처리");
        qa_list = [];
      }
    }

    const main_img = req.files?.["main_img"]?.[0]?.filename || null;
    const parking_img = req.files?.["parking_img"]?.[0]?.filename || null;
    const transport_img = req.files?.["transport_img"]?.[0]?.filename || null;

    // ✅ Q&A 이미지 경로 추가 (고정/커스텀)
    if (qa_mode === "fixed") {
      qa_list = qa_list.map((item, idx) => {
        const f = req.files?.[`q${idx + 1}_image`]?.[0];
        return {
          ...item,
          img: f?.filename ? `${URL_PREFIX}/${f.filename}` : null,
        };
      });
    } else if (qa_mode === "custom") {
      qa_list = qa_list.map((item, idx) => {
        const f = req.files?.[`customq${idx + 1}_image`]?.[0];
        return {
          ...item,
          img: f?.filename ? `${URL_PREFIX}/${f.filename}` : null,
        };
      });
    }

    console.log("🖼️ 이미지 파일명:", { main_img, parking_img, transport_img });
    console.log("📋 Q&A 리스트 (이미지 포함):", qa_list);

    // 1) 기본 정보 INSERT
    const result = await pool.query(
      `
      INSERT INTO traditional_market
      (market_name, address, lat, lng, main_img, phone, opening_hours, main_products, 
       event_info, facilities, parking_available, parking_img, transport_info,
       transport_img, free_pr, qa_mode, qa_list)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
      RETURNING id
      `,
      [
        market_name,
        address,
        lat ? parseFloat(lat) : null,
        lng ? parseFloat(lng) : null,
        main_img ? `${URL_PREFIX}/${main_img}` : null,
        phone,
        opening_hours,
        main_products,
        event_info,
        facilities,
        parking_available,
        parking_img ? `${URL_PREFIX}/${parking_img}` : null,
        transport_info,
        transport_img ? `${URL_PREFIX}/${transport_img}` : null,
        free_pr,
        qa_mode,
        JSON.stringify(qa_list),
      ]
    );

    const newId = result.rows[0].id;

    // 2) 서브 이미지 INSERT
    const subImgs = req.files?.["images"] || [];

    for (const file of subImgs) {
      await pool.query(
        `INSERT INTO traditional_market_images (market_id, img_path)
         VALUES ($1, $2)`,
        [newId, `${URL_PREFIX}/${file.filename}`]
      );
    }

    return res.json({ success: true, id: newId });
  } catch (err) {
    console.error("MARKET REGISTER ERROR:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
