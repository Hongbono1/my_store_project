import pool from '../db.js';

// 가게 자랑 등록 (insert)
export async function insertStorePride(req, res) {
    try {
        // 1. 대표사진(main_img)
        let main_image = null;
        if (req.files && req.files["main_img"] && req.files["main_img"][0]) {
            main_image = "/uploads/" + req.files["main_img"][0].filename;
        }

        // 2. 기본 데이터
        const {
            store_name,
            address,
            category,
            phone,
            qa_mode,      // "fixed" or "custom"
            free_pr
        } = req.body;

        // 3. QnA 데이터 조립
        let qna_list = [];

        if (qa_mode === "fixed") {
            // 고정질문 8개
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
            // 자유질문 최대 5개
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

        // 4. DB 저장
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
        console.log('[store_pride INSERT] pride_id =', result.rows[0].pride_id);

        res.json({ success: true, pride_id: result.rows[0].pride_id });
    } catch (err) {
        console.error('insertStorePride error:', err);
        res.status(500).json({ success: false, error: 'DB 저장 오류: ' + (err.message || '') });
    }
}

// pride_id로 상세조회
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
            try {
                data.qna_list = JSON.parse(data.qna_list);
            } catch {
                data.qna_list = [];
            }
        }
        res.json(data);
    } catch (err) {
        console.error('getStorePrideById error:', err);
        res.status(500).json({ error: 'DB 조회 오류' });
    }
}

// 전체 리스트 조회
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
                qna_list
            FROM store_pride
            ORDER BY created_at DESC
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
