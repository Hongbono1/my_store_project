// 예시 (artController.js)
export async function registerArt(req, res) {
  try {
    // 1) 파일(이미지) 경로 추출
    const images = (req.files && req.files.images)
      ? req.files.images.map(f => `/uploads/${f.filename}`)
      : [];

    // 2) 폼 데이터 추출
    const {
      type, title, category, date, place, main_img,
      description, host, fee, contact, start_date, end_date, time, venue,
      address, age_limit, capacity, tags, social1, social2, social3, booking_url, phone
    } = req.body;

    // 3) INSERT
    const result = await pool.query(
      `INSERT INTO subart (
        type, title, category, date, place, main_img, description, host, fee, contact,
        start_date, end_date, time, venue, address, age_limit, capacity, tags,
        social1, social2, social3, booking_url, images, phone, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18,
        $19, $20, $21, $22, $23, $24, $25, NOW()
      ) RETURNING id`,
      [
        type || null, title || null, category || null, date || null, place || null, images[0] || null,
        description || null, host || null, fee || null, contact || null,
        start_date || null, end_date || null, time || null, venue || null,
        address || null, age_limit || null, capacity ? Number(capacity) : null, tags || null,
        social1 || null, social2 || null, social3 || null, booking_url || null,
        images.length ? JSON.stringify(images) : null, phone || null
      ]
    );
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    console.error('registerArt error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}
