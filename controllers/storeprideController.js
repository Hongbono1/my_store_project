import pool from '../db.js';

// 가게 자랑 등록 (insert)
export async function insertStorePride(req, res) {
    try {
        // multer로 받은 파일 (대표사진)
        let main_image = null;
        if (req.file) {
            main_image = "/uploads/" + req.file.filename; // public/uploads 경로 (DB에는 /uploads/filename 저장)
        }

        // POST body에서 값 추출
        const {
            store_name,
            address,
            category,
            phone,
            qna_list,
            owner_pr
        } = req.body;

        // qna_list 처리 (문자열 또는 객체/배열)
        let qnaValue;
        if (qna_list === undefined || qna_list === null || qna_list === '') {
            qnaValue = '[]'; // 최소 빈 배열
        } else if (typeof qna_list === 'string') {
            try {
                JSON.parse(qna_list); // 유효 JSON 확인
                qnaValue = qna_list;
            } catch {
                qnaValue = JSON.stringify([{ question: '', answer: qna_list }]);
            }
        } else {
            qnaValue = JSON.stringify(qna_list);
        }

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
            qnaValue,
            owner_pr || null
        ];

        const result = await pool.query(sql, params);

        // pride_id 응답에 포함
        console.log('[store_pride INSERT] pride_id =', result.rows[0].pride_id);
        res.json({ success: true, pride_id: result.rows[0].pride_id });
    } catch (err) {
        console.error('insertStorePride error:', err);
        res.status(500).json({ success: false, error: 'DB 저장 오류' });
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
        // qna_list가 문자열이면 파싱
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
