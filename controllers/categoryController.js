// controllers/categoryController.js
import { pool } from "../db/pool.js";

/* ───────────────────────────────────────────────
 * 1) 전체 카테고리 목록 조회
 *    GET /category
 *    – store_info.business_category 컬럼에서 DISTINCT
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
    // ["한식", "중식", ...]
    res.json(rows.map(r => r.category));
  } catch (err) {
    console.error("getCategories ▶", err);
    res.status(500).json({ error: "카테고리 조회 오류" });
  }
}

/* ───────────────────────────────────────────────
 * 2) 특정 카테고리의 서브카테고리 목록 조회
 *    GET /category/:cat/sub
 *    – store_menu.category 값을 기준으로 추출
 * ───────────────────────────────────────────── */
export async function getSubcategories(req, res) {
  const { cat } = req.params;  // ex: '한식'
  try {
    const sql = `
      SELECT DISTINCT m.category AS sub
      FROM   store_menu m
      JOIN   store_info s ON m.store_id = s.id
      WHERE  s.business_category = $1
      ORDER  BY sub
    `;
    const { rows } = await pool.query(sql, [cat]);
    // ["밥", "국", "면", ...]
    res.json(rows.map(r => r.sub));
  } catch (err) {
    console.error("getSubcategories ▶", err);
    res.status(500).json({ error: "서브카테고리 조회 오류" });
  }
}

/* ───────────────────────────────────────────────
 * 3) 카테고리별 가게 목록 조회 (옵션: 서브카테고리 필터)
 *    GET /category/:cat/stores
 *    예) /category/한식/stores?subcategory=밥
 * ───────────────────────────────────────────── */
export async function getStoresByCategory(req, res) {
  const { cat }          = req.params;    // ex: '한식'
  const { subcategory }  = req.query;     // ex: '밥' or undefined

  const params = [cat];                   // $1 = category
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

  // 옵션: subcategory 파라미터가 있으면 store_menu.category 기준으로 필터
  if (subcategory) {
    sql += `
      AND EXISTS (
        SELECT 1
        FROM   store_menu m
        WHERE  m.store_id = s.id
          AND  m.category   = $2
      )
    `;
    params.push(subcategory);             // $2 = subcategory
  }

  sql += " ORDER BY s.id DESC";

  try {
    const { rows } = await pool.query(sql, params);
    res.json(rows);                       // 빈 배열이면 프런트에서 “결과 없음” 처리
  } catch (err) {
    console.error("getStoresByCategory ▶", err);
    res.status(500).json({ error: "가게 목록 조회 오류" });
  }
}
