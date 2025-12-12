// controllers/hotblosubController.js
import pool from "../db.js";

/**
 * 🔥 핫 서브카테고리 카드 목록 (hotblosub)
 *
 * - 프론트: /hotsubcategory.html 에서 /api/hotsubcategory 호출
 * - 응답 형식:
 *   {
 *     ok: true,
 *     data: [
 *       { id, title, store_name, business_category, cover_image, created_at },
 *       ...
 *     ]
 *   }
 */
export async function getHotblosubList(req, res) {
  try {
    console.log("[hotblosub] 목록 요청");

    // ⚠️ 테이블/컬럼 이름은 네 Neon DB 구조에 맞게 사용해야 함
    // 여기서는 예시로 hot_blogs 테이블을 사용
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

    return res.json({ ok: true, data });
  } catch (err) {
    console.error("[hotblosub] 목록 오류:", err);
    return res.status(500).json({
      ok: false,
      message: "핫 블로그 서브카테고리 목록을 불러오는 중 오류가 발생했습니다.",
    });
  }
}
