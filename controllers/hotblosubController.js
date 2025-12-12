// controllers/hotblosubController.js
import pool from "../db.js";

/**
 * 🔥 핫 서브카테고리 카드 목록
 * - 기준 테이블: hotsubcategory
 * - hotblogs 와 조인해서 cover_image 끌어옴
 */
export async function getHotSubList(req, res) {
  try {
    const { category } = req.query;
    const params = [];
    let where = "";

    // 나중에 ?category=한식 이런 식으로 필터 쓰고 싶을 때 대비
    if (category) {
      where = "WHERE hs.category = $1";
      params.push(category);
    }

    const query = `
      SELECT
        hs.id,                         -- 핫블로그 id (디테일 이동용)
        hs.title,                      -- 카드 제목(안 써도 됨)
        hs.category,                   -- 업종 (한식 등)
        hs.store_name,                 -- 상호명 (하늘식당 등)
        COALESCE(hb.cover_image, '') AS cover_image
      FROM hotsubcategory AS hs
      LEFT JOIN hotblogs AS hb
        ON hb.id = hs.id
      ${where}
      ORDER BY hs.id DESC;
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
