const pool = require('../db');

async function hasColumn(table, column) {
  const r = await pool.query(
    `SELECT 1 FROM information_schema.columns WHERE table_name=$1 AND column_name=$2`,
    [table, column]
  );
  return r.rowCount > 0;
}

exports.getHotBlog = async (req, res) => {
  const param = req.params.id;
  if (!param) return res.status(400).json({ success: false, message: 'id required' });

  try {
    const isNum = /^\d+$/.test(param);
    let rows = { rows: [] };

    if (isNum) {
      // 1) hotblogs.id 우선
      rows = await pool.query(
        `SELECT id, title, cover_image, store_name, phone, url, qa, created_at, user_id, category
         FROM hotblogs WHERE id = $1 ORDER BY id DESC LIMIT 1`, [param]
      );

      // 2) 없으면 stores.id 로 매핑 -> store_name 기준 검색
      if (!rows.rows.length) {
        const storeRow = await pool.query(`SELECT name FROM stores WHERE id = $1 LIMIT 1`, [param]);
        if (storeRow.rowCount) {
          const storeName = storeRow.rows[0].name;
          rows = await pool.query(
            `SELECT id, title, cover_image, store_name, phone, url, qa, created_at, user_id, category
             FROM hotblogs WHERE store_name = $1 ORDER BY id DESC LIMIT 1`, [storeName]
          );
        }
      }

      // 3) user_id로 시도
      if (!rows.rows.length) {
        rows = await pool.query(
          `SELECT id, title, cover_image, store_name, phone, url, qa, created_at, user_id, category
           FROM hotblogs WHERE user_id = $1 ORDER BY id DESC LIMIT 1`, [param]
        );
      }
    } else {
      // 문자열이면 store_name으로 조회
      rows = await pool.query(
        `SELECT id, title, cover_image, store_name, phone, url, qa, created_at, user_id, category
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

exports.listHotBlogs = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const { rows } = await pool.query(
      `SELECT id, title, cover_image, store_name, category, created_at
       FROM hotblogs ORDER BY created_at DESC LIMIT $1`, [limit]
    );
    return res.json({ success: true, blogs: rows });
  } catch (err) {
    console.error('listHotBlogs error', err);
    return res.status(500).json({ success: false });
  }
};

exports.getRandomHotBlog = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, title, cover_image, store_name, qa FROM hotblogs ORDER BY random() LIMIT 1`
    );
    if (!rows.length) return res.json({ success: false });
    const blog = rows[0];
    try { blog.qa = typeof blog.qa === 'string' ? JSON.parse(blog.qa) : blog.qa; } catch(e){ blog.qa = []; }
    return res.json({ success: true, blog });
  } catch (err) {
    console.error('getRandomHotBlog error', err);
    return res.status(500).json({ success: false });
  }
};