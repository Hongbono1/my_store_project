// controllers/storeprideController.js
const pool = require('../db'); // neon 연결 pool

// 우리가게자랑 등록 (POST)
exports.insertStorePride = async (req, res) => {
  try {
    const { store_name, address, category, main_image, qna_list, owner_pr } = req.body;
    // qna_list는 반드시 JSON.stringify해서 넣기 (프론트/서버 어느 쪽에서든)
    const result = await pool.query(
      `INSERT INTO store_pride
         (store_name, address, category, main_image, qna_list, owner_pr)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING pride_id`,
      [
        store_name,
        address,
        category,
        main_image,
        JSON.stringify(qna_list),
        owner_pr
      ]
    );
    res.json({ success: true, pride_id: result.rows[0].pride_id });
  } catch (error) {
    console.error('insertStorePride 에러:', error);
    res.status(500).json({ success: false, error: '서버 오류' });
  }
};

// 우리가게자랑 상세조회 (GET)
exports.getStorePrideById = async (req, res) => {
  try {
    const id = req.params.id;
    const result = await pool.query(
      'SELECT * FROM store_pride WHERE pride_id = $1',
      [id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });

    const data = result.rows[0];
    try {
      data.qna_list = data.qna_list ? JSON.parse(data.qna_list) : [];
    } catch (e) {
      data.qna_list = [];
    }
    res.json(data);
  } catch (error) {
    console.error('getStorePrideById 에러:', error);
    res.status(500).json({ error: '서버 오류' });
  }
};
