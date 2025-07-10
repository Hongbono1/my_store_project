// controllers/categoryController.js
import { pool } from "../db/pool.js";

/* ───────────────────────────────────────────────
 * 1) 전체 카테고리 목록 조회
 *    GET /category
 * ───────────────────────────────────────────── */
export async function getCategories(req, res) {
  try {
    const sql = `
      SELECT DISTINCT business_category AS category
      FROM   store_info
      WHERE  business_category IS NOT NULL
      ORDER  BY category
    `;
    const { rows } = await pool.query(sql);
    res.json(rows.map(r => r.category));           // ["한식", "중식", ...]
  } catch (err) {
    console.error("getCategories ▶", err);
    res.status(500).json({ error: "카테고리 조회 오류" });
  }
}

/* ───────────────────────────────────────────────
 * 2) 특정 카테고리의 서브카테고리 목록 조회
 *    GET /category/:category/sub
 * ───────────────────────────────────────────── */
export async function getSubcategories(req, res) {
  const { category } = req.params;                // ex: '한식'

  try {
    const sql = `
      SELECT DISTINCT m.category AS sub
      FROM   store_menu m
      JOIN   store_info s ON m.store_id = s.id
      WHERE  s.business_category = $1
      ORDER  BY sub
    `;
    const { rows } = await pool.query(sql, [category]);
    res.json(rows.map(r => r.sub));               // ["밥", "국", "면", ...]
  } catch (err) {
    console.error("getSubcategories ▶", err);
    res.status(500).json({ error: "서브카테고리 조회 오류" });
  }
}

/* ───────────────────────────────────────────────
 * 3) 카테고리별 가게 목록 조회 (옵션: 서브카테고리 필터)
 *    GET /category/:category/stores?subcategory=밥
 * ───────────────────────────────────────────── */
export async function getStoresByCategory(req, res) {
  const { category } = req.params;                // ex: '한식'
  const { subcategory } = req.query;              // ex: '밥' 또는 undefined

  // ── 디버그 로그
  console.log("▶ getStoresByCategory called");
  console.log("   params.category =", category);
  console.log("   query.subcategory =", subcategory);

  const params = [category];                      // $1 = category
  let sql = `
    SELECT
      s.id,
      s.business_name      AS "businessName",
      s.phone_number       AS "phone",
      COALESCE(s.image1,'') AS "thumb",
      s.business_category  AS "category"
    FROM store_info s
    WHERE s.business_category = $1
  `;

  if (subcategory) {
    sql += `
      AND EXISTS (
        SELECT 1
        FROM   store_menu m
        WHERE  m.store_id = s.id
          AND  m.category  = $2
      )
    `;
    params.push(subcategory);                    // $2 = subcategory
  }

  sql += " ORDER BY s.id DESC";

  console.log("   SQL:", sql.trim());
  console.log("   params array:", params);

  try {
    const { rows } = await pool.query(sql, params);
    console.log("▶ getStoresByCategory result rows:", rows);
    res.json(rows);                              // 빈 배열이면 프런트에서 “결과 없음” 처리
  } catch (err) {
    console.error("getStoresByCategory ▶", err);
    res.status(500).json({ error: "가게 목록 조회 오류" });
  }
}
