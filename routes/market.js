import pool from '../db.js';

// ▣ 마켓 등록 (POST)
export async function createMarket(req, res) {
  try {
    const b = req.body;
    const f = req.files || {};

    // qa_list(질문/답변/이미지) JSON으로 받아서, 각 이미지 파일명 매칭
    let qa_list = [];
    if (b.qa_list) {
      qa_list = JSON.parse(b.qa_list);
      // 각 질문별로 (q1_image ~ q8_image) 파일명 매칭
      qa_list.forEach((qa, idx) => {
        const imgField = `q${idx+1}_image`;
        if (f[imgField] && f[imgField][0]) {
          // multer에서 저장된 파일명
          qa.img = f[imgField][0].filename;
        } else {
          qa.img = ""; // 이미지 없는 경우 빈값
        }
      });
    }

    // 기타 단일 이미지 필드들
    const main_img = f.main_img?.[0]?.filename || null;
    const parking_img = f.parking_img?.[0]?.filename || null;
    const transport_img = f.transport_img?.[0]?.filename || null;

    const sql = `
      INSERT INTO market_info (
        market_name, address, main_img, phone, opening_hours, main_products,
        event_info, facilities, parking_available, parking_img,
        transport_info, transport_img, qa_list, free_pr
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14
      ) RETURNING id
    `;
    const values = [
      b.market_name,
      b.address,
      main_img,
      b.phone || null,
      b.opening_hours,
      b.main_products,
      b.event_info || null,
      b.facilities || null,
      b.parking_available,
      parking_img,
      b.transport_info || null,
      transport_img,
      JSON.stringify(qa_list),
      b.free_pr || null
    ];

    const { rows } = await pool.query(sql, values);
    res.status(201).json({ success: true, id: rows[0].id });
  } catch (err) {
    console.error('[market 등록 오류]', err);
    res.status(500).json({ success: false, error: '서버 오류' });
  }
}
