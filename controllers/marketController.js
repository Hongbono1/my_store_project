// controllers/marketController.js
import pool from '../db.js';

// ▣ 마켓 등록 (POST)
export async function createMarket(req, res) {
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
            qa_mode,
            free_pr
        } = req.body;

        // 이미지 파일 처리 (main_img, parking_img, transport_img)
        const main_img = req.files['main_img'] ? req.files['main_img'][0].filename : null;
        const parking_img = req.files['parking_img'] ? req.files['parking_img'][0].filename : null;
        const transport_img = req.files['transport_img'] ? req.files['transport_img'][0].filename : null;

        // 필수 항목 체크
        if (!market_name || !address || !main_img || !opening_hours || !main_products || !parking_available || !qa_mode) {
            return res.status(400).json({ success: false, error: '필수항목 누락' });
        }

        const sql = `
          INSERT INTO market_info (
            market_name, address, main_img, phone, opening_hours,
            main_products, event_info, facilities, parking_available, parking_img,
            transport_info, transport_img, qa_mode, free_pr
          ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9, $10,
            $11, $12, $13, $14
           ) RETURNING id
        `
        
        const values = [
            market_name,
            address,
            main_img,
            phone || null,
            opening_hours,
            main_products,
            event_info || null,
            facilities || null,
            parking_available,
            parking_img,
            transport_info || null,
            transport_img,
            qa_mode,
            free_pr || null
        ];

        const { rows } = await pool.query(sql, values);

        res.status(201).json({ success: true, id: rows[0].id });
    } catch (err) {
        console.error('[market 등록 오류]', err);
        res.status(500).json({ success: false, error: '서버 오류' });
    }
}

// ▣ 마켓 단건 조회 (GET)
export async function getMarketById(req, res) {
    try {
        const { id } = req.params;
        const sql = `SELECT * FROM market_info WHERE id = $1`;
        const { rows } = await pool.query(sql, [id]);
        if (rows.length === 0) {
            return res.status(404).json({ success: false, error: '마켓 정보 없음' });
        }
        res.json(rows[0]);
    } catch (err) {
        console.error('[market 단건조회 오류]', err);
        res.status(500).json({ success: false, error: '서버 오류' });
    }
}

// ▣ 마켓 전체 리스트 (GET)
export async function getAllMarkets(req, res) {
    try {
        const sql = `SELECT * FROM market_info ORDER BY id DESC`;
        const { rows } = await pool.query(sql);
        res.json(rows);
    } catch (err) {
        console.error('[market 전체조회 오류]', err);
        res.status(500).json({ success: false, error: '서버 오류' });
    }
}
