import pool from "../db.js";

// 쇼핑몰 등록
export async function registerShopping(req, res) {
  try {
    const body = req.body;

    const main = req.files["image_main"]?.[0]?.filename || null;
    const banners = req.files["image_banner"]?.map(f => f.filename) || [];
    const bests = req.files["image_best"]?.map(f => f.filename) || [];

    const inserted = await pool.query(`
      INSERT INTO shopping_info
      (shop_name, short_desc, full_desc, category, website,
       sns_instagram, sns_youtube, sns_blog, sns_other,
       image_main, image_banner1, image_banner2, image_banner3,
       image_best1, image_best2, image_best3, image_best4)
      VALUES ($1,$2,$3,$4,$5,
              $6,$7,$8,$9,
              $10,$11,$12,$13,
              $14,$15,$16,$17)
      RETURNING id;
    `, [
      body.shop_name,
      body.short_desc,
      body.full_desc || null,
      body.category,
      body.website,
      body.sns_instagram || null,
      body.sns_youtube || null,
      body.sns_blog || null,
      body.sns_other || null,
      main ? `/uploads/${main}` : null,
      banners[0] ? `/uploads/${banners[0]}` : null,
      banners[1] ? `/uploads/${banners[1]}` : null,
      banners[2] ? `/uploads/${banners[2]}` : null,
      bests[0] ? `/uploads/${bests[0]}` : null,
      bests[1] ? `/uploads/${bests[1]}` : null,
      bests[2] ? `/uploads/${bests[2]}` : null,
      bests[3] ? `/uploads/${bests[3]}` : null
    ]);

    res.json({ 
      success: true, 
      id: inserted.rows[0].id,
      message: "쇼핑몰 등록이 완료되었습니다."
    });

  } catch (error) {
    console.error("❌ 쇼핑몰 등록 실패:", error);
    res.status(500).json({ 
      success: false, 
      message: "등록 중 오류가 발생했습니다." 
    });
  }
}
