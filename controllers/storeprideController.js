import pool from '../db.js';  // 본인 db 연결 파일 확장자에 맞게

// 가게 자랑 등록 (insert)
export async function insertStorePride(req, res) {
    try {
        // POST body 파싱 (req.body, req.file 등)
        const {
            store_name,   // 가게명
            address,      // 주소
            category,     // 업종/카테고리
            phone,        // 전화번호
            main_image,   // 대표사진 경로
            qna_list,     // QnA 리스트 (배열 또는 문자열)
            owner_pr      // 사장님 한마디(PR)
        } = req.body;

        // qna_list가 객체(배열)이면 문자열로 변환
        let qnaValue;
        if (typeof qna_list === "string") {
            qnaValue = qna_list;  // 이미 stringify된 상태 (프론트에서 JSON.stringfy로 보냄)
        } else {
            qnaValue = JSON.stringify(qna_list);
        }

        const result = await pool.query(
            `INSERT INTO store_pride
                (store_name, address, category, phone, main_image, qna_list, owner_pr)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING pride_id`,
            [
                store_name,
                address,
                category,
                phone,
                main_image,
                qnaValue,
                owner_pr
            ]
        );
        res.json({ success: true, pride_id: result.rows[0].pride_id });
    } catch (err) {
        console.error('insertStorePride error:', err);
        res.status(500).json({ success: false, error: 'DB 저장 오류' });
    }
}

// pride_id로 상세조회
export async function getStorePrideById(req, res) {
    try {
        // pride_id는 반드시 숫자(정수)여야 함
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ error: '잘못된 pride_id' });
        }

        const result = await pool.query(
            'SELECT * FROM store_pride WHERE pride_id=$1',
            [id]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Not found' });

        // qna_list 파싱 (jsonb 타입이면 프론트와 협의에 따라 생략 가능)
        const data = result.rows[0];
        if (typeof data.qna_list === "string") {
            data.qna_list = JSON.parse(data.qna_list || '[]');
        }
        res.json(data);
    } catch (err) {
        console.error('getStorePrideById error:', err);
        res.status(500).json({ error: 'DB 조회 오류' });
    }
}
