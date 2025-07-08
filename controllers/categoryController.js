import { pool } from "../db/pool.js";

// 카테고리 리스트
export async function getCategories(req, res) {
  try {
    res.json(["식사", "분식", "카페"]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "서버 오류" });
  }
}

// 카테고리별 가게 목록
export async function getStoresByCategory(req, res) {
  const category = req.params.category || req.query.category || "";
  console.log("🛠️ getStoresByCategory called with category:", category);

  try {
    const sql = `
      SELECT
        id,
        business_name  AS "businessName",
        phone_number   AS "phone",
        image1         AS "thumbnailUrl"
      FROM store_info
      WHERE ($1 = '' OR business_category = $1)
    `;
    const { rows } = await pool.query(sql, [category]);
    console.log("🛠️ getStoresByCategory result:", rows.length, "rows");
    return res.json(rows);

  } catch (err) {
    // 에러 메시지와 스택 일부를 응답에 포함합니다
    console.error("🔴 getStoresByCategory error:", err);
    return res
      .status(500)
      .json({
        error: err.message,
        stack: err.stack.split("\n").slice(0,3)
      });
  }
}
