import pool from '../db.js';

// ▣ 마켓 등록 (POST)
export async function createMarket(req, res) {
  try {
    const b = req.body;
    const f = req.files || {};

    // qa_list(질문/답변/이미지)
    let qa_list = [];
    if (b.qa_list) {
      qa_list = JSON.parse(b.qa_list);
      qa_list.forEach((qa, idx) => {
        const imgField = `q${idx+1}_image`;
        if (f[imgField] && f[imgField][0]) {
          qa.img = f[imgField][0].filename;
        } else {
          qa.img = "";
        }
      });
    }

    // 기타 이미지 필드들
    const main_img = f.main_img?.[0]?.filename || null;
    const parking_img = f.parking_img?.[0]?.filename || null;
    const transport_img = f.transport_img?.[0]?.filename || null;

    // 필수값 체크
    if (!b.market_name || !b.address || !main_img || !b.opening_hours ||
        !b.main_products || !b.parking_available || !b.qa_mode || qa_list.length !== 8) {
      return res.status(400).json({ success: false, error: "필수항목 누락" });
    }

    // ← 컬럼 순서 맞게!
    const sql = `
      INSERT INTO market_info (
        qa_list, main_img, phone, opening_hours, main_products, event_info,
        facilities, parking_available, parking_img, transport_info, transport_img,
        qa_mode, free_pr, market_name, address
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15
      ) RETURNING id
    `;
    const values = [
      JSON.stringify(qa_list),
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
      b.qa_mode,
      b.free_pr || null,
      b.market_name,
      b.address
    ];

    const { rows } = await pool.query(sql, values);
    res.status(201).json({ success: true, id: rows[0].id });
  } catch (err) {
    console.error('[market 등록 오류]', err);
    res.status(500).json({ success: false, error: '서버 오류' });
  }
}
