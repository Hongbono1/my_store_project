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

    // ★★★ 컬럼 순서 맞춰서 INSERT! ★★★
    const sql = `
      INSERT INTO market_info (
        qa_list, main_img, phone, opening_hours, main_products, event_info,
        facilities, parking_available, parking_img, transport_info, transport_img,
        qa_mode, free_pr, market_name, address
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15
      )
      RETURNING id
    `;

    const values = [
      JSON.stringify(qa_list),   // $1: qa_list
      main_img,                  // $2
      b.phone || null,           // $3
      b.opening_hours,           // $4
      b.main_products,           // $5
      b.event_info || null,      // $6
      b.facilities || null,      // $7
      b.parking_available,       // $8
      parking_img,               // $9
      b.transport_info || null,  // $10
      transport_img,             // $11
      b.qa_mode,                 // $12
      b.free_pr || null,         // $13
      b.market_name,             // $14
      b.address                  // $15
    ];

    const { rows } = await pool.query(sql, values);
    return res.status(201).json({ success: true, id: rows[0].id });
  } catch (err) {
    console.error("[market 등록 오류]", err);
    return res.status(500).json({ success: false, error: "서버 오류" });
  }
}
