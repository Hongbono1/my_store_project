// controllers/hotblosubController.js
import pool from "../db.js";

/**
 * 🔥 핫 서브카테고리 목록 가져오기
 * - hotsubcategory 테이블 기준
 * - id, title, category, store_name 만 사용
 */
export async function getHotSubList(req, res) {
  try {
    // 추후 category 필터 쓰고 싶으면 ?category=한식 이런 식으로 쿼리 파라미터 사용 가능
    const { category } = req.query;
    const params = [];
    let where = "";

    if (category) {
      where = "WHERE category = $1";
      params.push(category);
    }

    const query = `
      SELECT
        id,
        title,
        category,
        store_name
      FROM hotsubcategory
      ${where}
      ORDER BY id DESC
    `;

    const { rows } = await pool.query(query, params);

    return res.json({
      ok: true,
      data: rows,
    });
  } catch (err) {
    console.error("[hotblosub] getHotSubList error:", err);
    return res.status(500).json({
      ok: false,
      error: "failed_to_load_hot_subcategory",
    });
  }
}
