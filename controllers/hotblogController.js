const pool = require('../db');

exports.getHotBlog = async (req, res) => {
  const param = req.params.id;
  if (!param) return res.status(400).json({ success: false, message: 'id required' });

  try {
    // 컬럼 존재 여부 확인
    const col = await pool.query(
      "SELECT 1 FROM information_schema.columns WHERE table_name='hotblogs' AND column_name='store_id'"
    );
    const hasStoreId = col.rowCount > 0;

    let rows;
    if (/^\d+$/.test(param)) {
      // 숫자 파라미터면 blog.id 또는 store_id로 시도
      if (hasStoreId) {
        rows = await pool.query(
          `SELECT id, store_id, title, cover_image, store_name, phone, url, qa, created_at
           FROM hotblogs WHERE id = $1 OR store_id = $1 ORDER BY id DESC LIMIT 1`, [param]
        );
      } else {
        rows = await pool.query(
          `SELECT id, title, cover_image, store_name, phone, url, qa, created_at
           FROM hotblogs WHERE id = $1 ORDER BY id DESC LIMIT 1`, [param]
        );
      }
    } else {
      // 문자열이면 store_name으로 검색
      rows = await pool.query(
        `SELECT id, title, cover_image, store_name, phone, url, qa, created_at
         FROM hotblogs WHERE store_name = $1 ORDER BY id DESC LIMIT 1`, [param]
      );
    }

    if (!rows.rows.length) return res.json({ success: false, message: 'not found' });

    const blog = rows.rows[0];
    try { blog.qa = typeof blog.qa === 'string' ? JSON.parse(blog.qa) : blog.qa; } catch (e) { blog.qa = []; }
    return res.json({ success: true, blog });
  } catch (err) {
    console.error('getHotBlog error', err);
    return res.status(500).json({ success: false });
  }
};