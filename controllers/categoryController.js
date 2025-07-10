// controllers/categoryController.js
import { pool } from "../db/pool.js";

/* ───────────────────────────────────────────────
 * 1) 카테고리 목록           GET /category
 *    – 단순하게 DISTINCT 조회 (한식·중식·…)
 * ───────────────────────────────────────────── */
export async function getCategories(req, res) {
  try {
    const sql = `
      SELECT DISTINCT business_category AS category
      FROM   store_info
      WHERE  business_category IS NOT NULL
      ORDER  BY category`;
    const { rows } = await pool.query(sql);
    res.json(rows.map(r => r.category));           // ["한식","중식",…]
  } catch (err) {
    console.error("getCategories ▶", err);
    res.status(500).json({ error: "카테고리 조회 오류" });
  }
}

/* ───────────────────────────────────────────────
 * 2) 서브카테고리(분야) 목록  GET /category/:cat/sub
 *    – store_menu.category 값을 기준으로 추출
 *      (예: 한식 → ["밥","국","면"])
 * ───────────────────────────────────────────── */
export async function getSubcategories(req, res) {
  const { cat } = req.params;                      // '한식'
  try {
    const sql = `
      SELECT DISTINCT m.category AS sub
      FROM   store_menu m
      JOIN   store_info s ON m.store_id = s.id
      WHERE  s.business_category = $1
      ORDER  BY sub`;
    const { rows } = await pool.query(sql, [cat]);
    res.json(rows.map(r => r.sub));                // ["밥","국",…]
  } catch (err) {
    console.error("getSubcategories ▶", err);
    res.status(500).json({ error: "서브카테고리 조회 오류" });
  }
}

/* ───────────────────────────────────────────────
 * 3) 가게 목록               GET /category/:cat/stores
 *    – cat(필수) + subcategory(옵션) 파라미터
 *    – subcategory 없으면 한식 전체, 있으면 해당 분야만
 * ───────────────────────────────────────────── */
export async function getStoresByCategory(req, res) {
  const { cat }         = req.params;              // '한식'
  const { subcategory } = req.query;               // '밥' | undefined

  const params = [cat];                            // $1 = '한식'
  let sql = `
    SELECT s.id,
           s.business_name AS "businessName",
           s.phone_number  AS "phone",
           COALESCE(s.image1,'') AS "thumb",
           s.business_category  AS "category"
    FROM   store_info s
    WHERE  s.business_category = $1`;

  /* ▼ 서브카테고리 지정 시:
   *    store_menu.category = $2 인 메뉴가 하나라도 있는 가게만 반환
   */
  if (subcategory) {
    sql += `
      AND EXISTS (
        SELECT 1
        FROM   store_menu m
        WHERE  m.store_id = s.id
          AND  m.category = $2
      )`;
    params.push(subcategory);                      // $2 = '밥'
  }

  sql += " ORDER BY s.id DESC";

  try {
    const { rows } = await pool.query(sql, params);
    res.json(rows);                                // 빈 배열이면 프런트에서 “결과 없음” 처리
  } catch (err) {
    console.error("getStoresByCategory ▶", err);
    res.status(500).json({ error: "가게 목록 조회 오류" });
  }
}
