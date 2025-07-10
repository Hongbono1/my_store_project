// controllers/categoryController.js
import { pool } from "../db/pool.js";

/* ────────────────────────────────
   ✅ 1) 카테고리 전체 리스트
   ──────────────────────────────── */
export async function getCategories(req, res) {
  try {
    // 나중에 DB SELECT로 교체해도 OK
    res.json(["식사", "분식", "카페"]);
  } catch (err) {
    console.error("🔴 getCategories error:", err);
    res.status(500).json({ error: "서버 오류" });
  }
}

/* ────────────────────────────────
   ✅ 2) 특정 카테고리별 가게 목록
   ──────────────────────────────── */
export async function getStoresByCategory(req, res) {
  const category = req.params.category || req.query.category || "";
  console.log("🛠️ getStoresByCategory called with category:", category);

  try {
    const sql = `
      SELECT
        id,
        business_name        AS "businessName",
        phone_number         AS "phone",
        image1               AS "thumbnailUrl",
        business_subcategory AS "category",      -- ✅ 소분류 (필터용)
        business_category    AS "mainCategory"   -- ✅ 대분류 (보존용)
      FROM store_info
      WHERE business_category = $1
    `;

    const { rows } = await pool.query(sql, [category]);
    console.log("🛠️ getStoresByCategory result:", rows.length, "rows");
    return res.json(rows);

  } catch (err) {
    console.error("🔴 getStoresByCategory error:", err);
    return res.status(500).json({
      error: err.message,
      stack: err.stack.split("\n").slice(0, 3)
    });
  }
}
