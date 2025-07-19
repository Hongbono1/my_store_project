import pool from '../db.js';  // 본인 db 연결 파일 확장자에 맞게

// 가게 자랑 등록 (insert)
export async function insertStorePride(req, res) {
    try {
        // POST body 파싱 (req.body, req.file 등)
        const { store_name, address, category, main_image, qna_list, owner_pr } = req.body;
        // qna_list는 JSON.stringify 해서 넘겨야 함 (배열 형태)
        const result = await pool.query(
            `INSERT INTO store_pride (store_name, address, category, main_image, qna_list, owner_pr)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING pride_id`,
            [
                store_name,
                address,
                category,
                phone,
                main_image,
                JSON.stringify(qna_list),
                owner_pr
            ]
        );
        res.json({ success: true, pride_id: result.rows[0].pride_id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'DB 저장 오류' });
    }
}

// pride_id로 상세조회
export async function getStorePrideById(req, res) {
    try {
        const id = req.params.id;
        const result = await pool.query('SELECT * FROM store_pride WHERE pride_id=$1', [id]);
        if (!result.rows.length) return res.status(404).json({ error: 'Not found' });

        // qna_list 파싱
        const data = result.rows[0];
        data.qna_list = JSON.parse(data.qna_list || '[]');
        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'DB 조회 오류' });
    }
}
