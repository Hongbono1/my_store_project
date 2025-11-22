import pool from "../db.js";

// 쇼핑몰 상세 조회
export async function getShoppingDetail(req, res) {
  try {
    const id = req.params.id;
    const result = await pool.query(
      "SELECT * FROM shopping_info WHERE id = $1",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "쇼핑몰을 찾을 수 없습니다."
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("❌ 쇼핑몰 상세 조회 실패:", error);
    res.status(500).json({
      success: false,
      error: "서버 오류가 발생했습니다."
    });
  }
}

// 쇼핑몰 리스트 조회
export async function getShoppingList(req, res) {
  try {
    const { category, keyword, limit = 20, offset = 0 } = req.query;

    let query = "SELECT * FROM shopping_info WHERE 1=1";
    let params = [];
    let paramIndex = 1;

    // 카테고리 필터 (기본 카테고리 또는 커스텀 카테고리)
    if (category) {
      query += ` AND (category = $${paramIndex} OR custom_category = $${paramIndex})`;
      params.push(category);
      paramIndex++;
    }

    // 검색어 필터 (쇼핑몰 이름, 짧은 설명, 전체 설명)
    if (keyword) {
      query += ` AND (shop_name ILIKE $${paramIndex} OR short_desc ILIKE $${paramIndex} OR full_desc ILIKE $${paramIndex})`;
      params.push(`%${keyword}%`);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    res.json(result.rows);
  } catch (error) {
    console.error("❌ 쇼핑몰 리스트 조회 실패:", error);
    res.status(500).json({
      success: false,
      error: "서버 오류가 발생했습니다."
    });
  }
}
