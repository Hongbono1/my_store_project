// controllers/storeprideController.js
// ★ 우리가게 자랑(스토어프라이드) 전용 컨트롤러 ★
// 메인/인덱스 컨트롤러(indexController)와 완전히 별도!

import { pool } from "../db/pool.js";

// 가게 자랑 등록
export async function insertStorePride(req, res) {
    try {
        let main_image = null;
        if (req.files && req.files["main_img"] && req.files["main_img"][0]) {
            main_image = "/uploads/" + req.files["main_img"][0].filename;
        }

        const {
            store_name, address, category, phone, qa_mode, free_pr
        } = req.body;

        // QnA 리스트 구성
        let qna_list = [];
        if (qa_mode === "fixed") {
            for (let i = 1; i <= 8; i++) {
                const question = req.body[`q${i}_question`] || "";
                const answer = req.body[`q${i}_answer`] || "";
                let image = null;
                if (req.files && req.files[`q${i}_image`] && req.files[`q${i}_image`][0]) {
                    image = "/uploads/" + req.files[`q${i}_image`][0].filename;
                }
                qna_list.push({ question, answer, image });
            }
        } else if (qa_mode === "custom") {
            for (let i = 1; i <= 5; i++) {
                if (!req.body[`customq${i}_question`] && !req.body[`customq${i}_answer`]) continue;
                const question = req.body[`customq${i}_question`] || "";
                const answer = req.body[`customq${i}_answer`] || "";
                let image = null;
                if (req.files && req.files[`customq${i}_image`] && req.files[`customq${i}_image`][0]) {
                    image = "/uploads/" + req.files[`customq${i}_image`][0].filename;
                }
                qna_list.push({ question, answer, image });
            }
        }

        // DB 저장
        const sql = `
          INSERT INTO store_pride
            (store_name, address, category, phone, main_image, qna_list, owner_pr)
          VALUES
            ($1, $2, $3, $4, $5, $6, $7)
          RETURNING pride_id
        `;
        const params = [
            store_name || null,
            address || null,
            category || null,
            phone || null,
            main_image || null,
            JSON.stringify(qna_list),
            free_pr || null
        ];
        const result = await pool.query(sql, params);

        res.json({ success: true, pride_id: result.rows[0].pride_id });
    } catch (err) {
        console.error('insertStorePride error:', err);
        res.status(500).json({ success: false, error: 'DB 저장 오류: ' + (err.message || '') });
    }
}

// pride_id로 상세 조회
export async function getStorePrideById(req, res) {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ error: 'invalid pride_id' });
        }
        const result = await pool.query(
            'SELECT * FROM store_pride WHERE pride_id = $1',
            [id]
        );
        if (!result.rows.length) {
            return res.status(404).json({ error: 'Not found' });
        }
        const data = result.rows[0];
        if (typeof data.qna_list === 'string') {
            try { data.qna_list = JSON.parse(data.qna_list); }
            catch { data.qna_list = []; }
        }
        res.json(data);
    } catch (err) {
        console.error('getStorePrideById error:', err);
        res.status(500).json({ error: 'DB 조회 오류' });
    }
}

// 전체 리스트 조회 (최신순)
export async function getStorePrideList(req, res) {
    try {
        const result = await pool.query(`
            SELECT
              pride_id,
              store_name,
              category,
              address,
              phone,
              main_image,
              owner_pr,
              qna_list,
              COALESCE(view_count, 0) AS views,
              created_at
            FROM store_pride
            ORDER BY created_at DESC
            LIMIT 50
        `);

        const data = result.rows.map(row => ({
            ...row,
            qna_list: typeof row.qna_list === 'string'
                ? JSON.parse(row.qna_list)
                : row.qna_list
        }));
        res.json(data);
    } catch (err) {
        console.error('getStorePrideList error:', err);
        res.status(500).json({ error: '리스트 조회 오류' });
    }
}
