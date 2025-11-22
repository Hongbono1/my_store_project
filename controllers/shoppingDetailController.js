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
    const { category, limit = 20, offset = 0 } = req.query;

    let query = "SELECT * FROM shopping_info";
    let params = [];

    if (category) {
      query += " WHERE category = $1";
      params.push(category);
      query += " ORDER BY created_at DESC LIMIT $2 OFFSET $3";
      params.push(limit, offset);
    } else {
      query += " ORDER BY created_at DESC LIMIT $1 OFFSET $2";
      params.push(limit, offset);
    }

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error("❌ 쇼핑몰 리스트 조회 실패:", error);
    res.status(500).json({
      success: false,
      error: "서버 오류가 발생했습니다."
    });
  }
}
