const pool = require('../db');

exports.getHotBlog = async (req, res) => {
  const param = req.params.id;
  if (!param) return res.status(400).json({ success: false, message: 'id required' });

  try {
    // 숫자 파라미터인지 확인
    const isNum = /^\d+$/.test(param);

    let rows;

    if (isNum) {
      // 1) 우선 blog.id 로 시도
      rows = await pool.query(
        `SELECT id, title, cover_image, store_name, phone, url, qa, created_at, user_id
         FROM hotblogs WHERE id = $1 ORDER BY id DESC LIMIT 1`, [param]
      );

      // 2) 못 찾았으면, 같은 숫자를 가진 store가 있는지 찾아서 store_name 기준으로 검색
      if (!rows.rows.length) {
        const storeRow = await pool.query(`SELECT name FROM stores WHERE id = $1 LIMIT 1`, [param]);
        if (storeRow.rowCount) {
          const storeName = storeRow.rows[0].name;
          rows = await pool.query(
            `SELECT id, title, cover_image, store_name, phone, url, qa, created_at, user_id
             FROM hotblogs WHERE store_name = $1 ORDER BY id DESC LIMIT 1`, [storeName]
          );
        }
      }

      // 3) 여전히 못 찾았으면 user_id(작성자 id)로도 시도
      if (!rows.rows.length) {
        rows = await pool.query(
          `SELECT id, title, cover_image, store_name, phone, url, qa, created_at, user_id
           FROM hotblogs WHERE user_id = $1 ORDER BY id DESC LIMIT 1`, [param]
        );
      }
    } else {
      // 문자열인 경우엔 store_name으로 검색
      rows = await pool.query(
        `SELECT id, title, cover_image, store_name, phone, url, qa, created_at, user_id
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