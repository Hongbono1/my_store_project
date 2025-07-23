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
    const main_img      = filePath(f, "main_img");
    const parking_img   = filePath(f, "parking_img");
    const transport_img = filePath(f, "transport_img");

    // 필수값 체크
    if (
      !b.market_name ||
      !b.address ||
      !main_img ||
      !b.opening_hours ||
      !b.main_products ||
      !b.parking_available ||
      !b.qa_mode
    ) {
      return res.status(400).json({ success: false, error: "필수항목 누락" });
    }

    const sql = `
      INSERT INTO market_info (
        market_name, address, main_img, phone, opening_hours, main_products,
        event_info, facilities, parking_available, parking_img,
        transport_info, transport_img, qa_mode, free_pr
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14
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
      b.parking_available,              // 'Y' / 'N'
      parking_img,
      b.transport_info || null,
      transport_img,
      b.qa_mode,
      b.free_pr || null,
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
