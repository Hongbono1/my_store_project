import pool from "../db.js";

export async function getBestPickStores(req, res) {
  try {
    // open_stores, store_pride, traditional_market 에서 랜덤하게 가져오기
    const result = await pool.query(`
      SELECT * FROM (
        (SELECT id, store_name as name, category, main_img as image, 'open' as type 
         FROM open_stores 
         WHERE main_img IS NOT NULL AND main_img != ''
         ORDER BY RANDOM() 
         LIMIT 6)
        UNION ALL
        (SELECT id, store_name as name, category, main_img as image, 'pride' as type 
         FROM store_pride 
         WHERE main_img IS NOT NULL AND main_img != ''
         ORDER BY RANDOM() 
         LIMIT 6)
        UNION ALL
        (SELECT id, market_name as name, '전통시장' as category, main_img as image, 'market' as type 
         FROM traditional_market 
         WHERE main_img IS NOT NULL AND main_img != ''
         ORDER BY RANDOM() 
         LIMIT 6)
      ) as combined
      ORDER BY RANDOM()
      LIMIT 18
    `);

    // 데이터가 없으면 빈 배열 반환
    return res.json(result.rows || []);
  } catch (err) {
    console.error("BEST PICK ERROR:", err);
    // 에러 발생 시 빈 배열 반환 (프론트엔드에서 더미 데이터 사용)
    return res.json([]);
  }
}
