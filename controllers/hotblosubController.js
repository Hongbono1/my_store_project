// controllers/hotblosubController.js
import pool from "../db.js";

/**
 * 🔥 핫 서브카테고리 카드 목록 (hotblosub)
 *
 * - 프론트: /hotsubcategory.html → /api/hotsubcategory 호출
 * - 응답 형식:
 *   {
 *     success: true,
 *     data: [
 *       { id, title, store_name, business_category, cover_image, created_at },
 *       ...
 *     ]
 *   }
 */
export async function getHotblosubList(req, res) {
  try {
    console.log("[hotblosub] 목록 요청");

    // ⚠️ 테이블 이름은 실제 사용하는 테이블로 맞춰야 함
    //   - hot_blogs 를 쓰면 그대로
    //   - hotblogs 를 쓰면 FROM 절만 hotblogs 로 바꾸면 됨
    const result = await pool.query(`
      SELECT
        id,
        title,
        store_name,
        business_category,
        cover_image,
        created_at
      FROM hot_blogs
      ORDER BY id DESC
    `);

    const rows = result.rows || [];

    const data = rows.map((row) => ({
      id: row.id,
      title: row.title,
      store_name: row.store_name,
      business_category: row.business_category,
      cover_image: row.cover_image,
      created_at: row.created_at,
    }));

    return res.json({ success: true, data });
  } catch (err) {
    console.error("[hotblosub] 목록 오류:", err);
    return res.status(500).json({
      success: false,
      message: "핫 블로그 서브카테고리 목록을 불러오는 중 오류가 발생했습니다.",
    });
  }
}
