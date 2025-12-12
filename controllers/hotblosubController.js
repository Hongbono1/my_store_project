// controllers/hotblosubController.js
import pool from "../db.js";

/**
 * 🔥 핫 서브카테고리 카드 목록
 * - 실제 글이 들어있는 hotblogs 테이블에서 직접 가져온다
 * - 위: 대표 이미지(cover_image)
 * - 아래: 상호(store_name) / 업종(category)
 */
export async function getHotSubList(req, res) {
  try {
    console.log("[hotblosub] getHotSubList called");

    // 🔹 hotblogdetail 에 쓰는 테이블 이름과 반드시 맞춰줘야 함
    //   → 거기서 hot_blogs 를 쓰고 있다면, 여기 FROM hotblogs 를 FROM hot_blogs 로 바꿔줘.
    const query = `
      SELECT
        id,
        title,
        category,
        store_name,
        cover_image
      FROM hotblogs
      ORDER BY id DESC
      LIMIT 120;   -- 최대 10페이지(12개*10) 정도 여유
    `;

    const { rows } = await pool.query(query);
    console.log("[hotblosub] rows length:", rows.length);

    // 그대로 내려줘도 되지만, 프론트 구조에 맞춰 한 번 정리해줌
    const data = rows.map((row) => ({
      id: row.id,
      title: row.title,
      category: row.category,
      store_name: row.store_name,
      cover_image: row.cover_image,
    }));

    return res.json({
      ok: true,
      data,
    });
  } catch (err) {
    console.error("[hotblosub] getHotSubList error:", err);
    return res.status(500).json({
      ok: false,
      error: "failed_to_load_hot_subcategory",
    });
  }
}
