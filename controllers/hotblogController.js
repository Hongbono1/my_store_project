// controllers/hotsubcategoryController.js
import pool from "../db.js";

/* =========================================================
   📊 핫 서브카테고리 목록 조회 (hotblogs 테이블 기반)
   ========================================================= */
export async function getHotSubcategories(req, res) {
  try {
    const { category = "all", sort = "latest", search = "" } = req.query;

    let query = `
      SELECT id, title, store_name, category, cover_image, phone, url, address, qa_mode, qa, created_at
      FROM hotblogs
    `;
    const params = [];

    // 🔹 카테고리 필터
    if (category && category !== "all") {
      params.push(category);
      query += ` WHERE category = $${params.length}`;
    }

    // 🔹 검색어 필터
    if (search) {
      const keyword = `%${search}%`;
      if (params.length) query += " AND";
      else query += " WHERE";
      params.push(keyword);
      query += ` (title ILIKE $${params.length} OR store_name ILIKE $${params.length})`;
    }

    // 🔹 정렬 조건
    switch (sort) {
      case "latest":
        query += " ORDER BY created_at DESC";
        break;
      default:
        query += " ORDER BY id DESC";
    }

    const result = await pool.query(query, params);
    res.json({ success: true, count: result.rowCount, data: result.rows });
  } catch (err) {
    console.error("🔥 [getHotSubcategories] 오류:", err);
    res.status(500).json({
      success: false,
      message: "핫 서브카테고리 데이터를 불러오는 중 오류 발생",
      error: err.message,
    });
  }
}
