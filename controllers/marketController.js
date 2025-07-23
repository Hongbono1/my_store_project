// controllers/marketController.js
import pool from "../db.js";

// 공통: 업로드된 파일 경로 만들기
const filePath = (files, field) =>
  files?.[field]?.[0]?.filename ? `/uploads/${files[field][0].filename}` : null;

/* ▣ 마켓 등록 (POST) */
export async function createMarket(req, res) {
  try {
    const b = req.body;
    const f = req.files || {};

    // 파일 경로 정리
    const main_img = filePath(f, "main_img");
    const parking_img = filePath(f, "parking_img");
    const transport_img = filePath(f, "transport_img");

    // ⬇️ qa_list(질문/답변/이미지) 처리
    let qa_list = [];
    if (b.qa_list) {
      qa_list = JSON.parse(b.qa_list);
      // q1_image ~ q8_image 필드 자동 매칭
      qa_list.forEach((qa, idx) => {
        const imgField = `q${idx + 1}_image`;
        if (f[imgField] && f[imgField][0]) {
          qa.img = f[imgField][0].filename;
        } else {
          qa.img = "";
        }
      });
    }

    // 필수값 체크 (qa_list도 필수로 원하면 추가)
    if (
      !b.market_name ||
      !b.address ||
      !main_img ||
      !b.opening_hours ||
      !b.main_products ||
      !b.parking_available ||
      !b.qa_mode ||
      qa_list.length !== 8 // 8개 다 받아야 할 경우
    ) {
      return res.status(400).json({ success: false, error: "필수항목 누락" });
    }

    const sql = `
      INSERT INTO market_info (
        market_name, address, main_img, phone, opening_hours, main_products,
        event_info, facilities, parking_available, parking_img,
        transport_info, transport_img, qa_mode, free_pr, qa_list
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15
      )
      RETURNING id
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
      b.qa_mode,
      b.free_pr || null,
      JSON.stringify(qa_list),  // <-- qa_list 추가!
    ];

    const { rows } = await pool.query(sql, values);
    return res.status(201).json({ success: true, id: rows[0].id });
  } catch (err) {
    console.error("[market 등록 오류]", err);
    return res.status(500).json({ success: false, error: "서버 오류" });
  }
}