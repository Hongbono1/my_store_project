import pool from "../db.js";

export async function registerPerformingArt(req, res) {
  try {
    console.log("📥 공연/예술 등록 요청 받음");
    console.log("Body:", req.body);
    console.log("Files:", req.files);

    const {
      type,
      title,
      start_date,
      end_date,
      time,
      venue,
      address,
      description,
      price,
      host,
      age_limit,
      capacity,
      tags,
      social1,
      social2,
      social3,
      booking_url,
      phone,
    } = req.body;

    // 파일 처리
    const images = req.files?.images || [];
    const pamphlets = req.files?.pamphlet || [];

    console.log(`📸 이미지: ${images.length}개, 📄 팜플렛: ${pamphlets.length}개`);

    // 대표 이미지 (첫 번째 이미지)
    const main_img = images[0] ? `/uploads/performingart/${images[0].filename}` : null;

    // DB 저장 - 메인 데이터
    const result = await pool.query(
      `INSERT INTO performing_arts (
        type, title, start_date, end_date, time, venue, address, description,
        price, host, age_limit, capacity, tags, social1, social2, social3,
        booking_url, phone, main_img
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING id`,
      [
        type || "공연",
        title,
        start_date,
        end_date || null,
        time || null,
        venue || null,
        address || null,
        description,
        price || null,
        host || null,
        age_limit || null,
        capacity ? parseInt(capacity) : null,
        tags || null,
        social1 || null,
        social2 || null,
        social3 || null,
        booking_url || null,
        phone || null,
        main_img,
      ]
    );

    const artId = result.rows[0].id;
    console.log(`✅ 공연/예술 등록 완료 ID: ${artId}`);

    // 추가 이미지 저장 (2번째, 3번째)
    for (let i = 1; i < images.length; i++) {
      const imgPath = `/uploads/performingart/${images[i].filename}`;
      await pool.query(
        `INSERT INTO performing_arts_files (art_id, file_type, file_path) VALUES ($1, $2, $3)`,
        [artId, "image", imgPath]
      );
    }

    // 팜플렛 저장
    for (const pamphlet of pamphlets) {
      const pamPath = `/uploads/performingart/${pamphlet.filename}`;
      await pool.query(
        `INSERT INTO performing_arts_files (art_id, file_type, file_path) VALUES ($1, $2, $3)`,
        [artId, "pamphlet", pamPath]
      );
    }

    return res.json({ success: true, id: artId });
  } catch (err) {
    console.error("❌ 공연/예술 등록 오류:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
