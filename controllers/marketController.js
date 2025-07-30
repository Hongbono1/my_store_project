// controllers/marketController.js
import pool from "../db.js";

/** 업로드된 파일 경로 반환 */
const filePath = (files, field) =>
  files?.[field]?.[0]?.filename ? `/uploads/${files[field][0].filename}` : null;

/** JSON 파싱 가드 */
function safeJsonParse(str, fallback = []) {
  try {
    if (!str) return fallback;
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

/* ▣ 마켓 등록 (POST) */
export async function createMarket(req, res) {
  try {
    const b = req.body;
    const f = req.files || {};

    // 디버그 로그 (필요 없으면 주석 처리)
    console.log("BODY >>>", b);
    console.log("FILES >>>", Object.keys(f));
    // 기본 이미지 필드
    const main_img      = filePath(f, "main_img");
    const parking_img   = filePath(f, "parking_img");
    const transport_img = filePath(f, "transport_img");

    // qa_list(질문/답변/이미지) 처리
    let qa_list = safeJsonParse(b.qa_list, []);
    qa_list.forEach((qa, idx) => {
      const imgField = `q${idx + 1}_image`;
      qa.img = f[imgField]?.[0]?.filename || "";
    });

    // 필수값 체크
    const missing = [];
    if (!b.market_name)        missing.push("market_name");
    if (!b.address)            missing.push("address");
    if (!main_img)             missing.push("main_img");
    if (!b.opening_hours)      missing.push("opening_hours");
    if (!b.main_products)      missing.push("main_products");
    if (!b.parking_available)  missing.push("parking_available");
    if (!b.qa_mode)            missing.push("qa_mode");
    if (!Array.isArray(qa_list) || qa_list.length !== 1) missing.push("qa_list(1이상)");

    if (missing.length) {
      console.log("❌ Missing fields:", missing);
      return res.status(400).json({ success: false, error: "필수항목 누락", missing });
    }

    // DB 컬럼 순서에 맞춰 INSERT
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
      JSON.stringify(qa_list),        // $1
      main_img,                       // $2
      b.phone || null,                // $3
      b.opening_hours,                // $4
      b.main_products,                // $5
      b.event_info || null,           // $6
      b.facilities || null,           // $7
      b.parking_available,            // $8
      parking_img,                    // $9
      b.transport_info || null,       // $10
      transport_img,                  // $11
      b.qa_mode,                      // $12
      b.free_pr || null,              // $13
      b.market_name,                  // $14
      b.address                       // $15
    ];

    const { rows } = await pool.query(sql, values);
    return res.status(201).json({ success: true, id: rows[0].id });
  } catch (err) {
    console.error("[market 등록 오류]", err);
    return res.status(500).json({ success: false, error: "서버 오류" });
  }
}

/* ▣ 마켓 단건 조회 (GET) */
export async function getMarketById(req, res) {
  try {
    const { id } = req.params;
    const sql = `SELECT * FROM market_info WHERE id = $1`;
    const { rows } = await pool.query(sql, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: "마켓 정보 없음" });
    }
    return res.json(rows[0]);
  } catch (err) {
    console.error("[market 단건조회 오류]", err);
    return res.status(500).json({ success: false, error: "서버 오류" });
  }
}

/* ▣ 마켓 전체 리스트 (GET) */
export async function getAllMarkets(_req, res) {
  try {
    const sql = `SELECT * FROM market_info ORDER BY id DESC`;
    const { rows } = await pool.query(sql);
    return res.json(rows);
  } catch (err) {
    console.error("[market 전체조회 오류]", err);
    return res.status(500).json({ success: false, error: "서버 오류" });
  }
}
