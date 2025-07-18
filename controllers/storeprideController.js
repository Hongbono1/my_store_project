// controllers/storePrideController.js
const pool = require('../db'); // neon 연결 pool

exports.insertStorePride = async (req, res) => {
  const { store_name, address, category, main_image, qna_list, owner_pr } = req.body;
  // main_image, qna_list 등은 파일/JSON으로 저장 (가공 필요)
  const result = await pool.query(
    `INSERT INTO store_pride (store_name, address, category, main_image, qna_list, owner_pr)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING pride_id`,
    [store_name, address, category, main_image, JSON.stringify(qna_list), owner_pr]
  );
  res.json({ success:true, pride_id: result.rows[0].pride_id });
};

exports.getStorePrideById = async (req, res) => {
  const id = req.params.id;
  const result = await pool.query('SELECT * FROM store_pride WHERE pride_id=$1', [id]);
  if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
  // qna_list가 JSON이라면 파싱
  const data = result.rows[0];
  data.qna_list = JSON.parse(data.qna_list || '[]');
  res.json(data);
};
