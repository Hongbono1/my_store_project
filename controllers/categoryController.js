import { pool } from "../db/pool.js";

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
    console.error("🔴 getStoresByCategory error:", err);
    return res
      .status(500)
      .json({
        error: err.message,
        stack: err.stack.split("\n").slice(0,3)
      });
  }
}
