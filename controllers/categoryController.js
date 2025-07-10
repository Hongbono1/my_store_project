// controllers/categoryController.js
import { pool } from "../db/pool.js";

/* 1) 카테고리(업종 구분) 목록 */
export async function getCategories(req, res) {
  try {
    const { rows } = await pool.query(`
      SELECT DISTINCT business_category AS category
      FROM store_info
      WHERE business_category IS NOT NULL
      ORDER BY category
    `);
    res.json(rows.map(r => r.category));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "카테고리 조회 오류" });
  }
}

/* 2) 소제목 목록(8 개) */
export async function getSubcategories(req, res) {
  const { category } = req.params;          // ex) '한식'
  try {
    const { rows } = await pool.query(`
      SELECT DISTINCT business_subcategory AS sub
      FROM store_info
      WHERE business_category = $1
      ORDER BY sub
    `, [category]);
    res.json(rows.map(r => r.sub));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "소제목 조회 오류" });
  }
}

/* 3) 가게 목록 (옵션: 소제목 필터) */
export async function getStoresByCategory(req, res) {
  const { category } = req.params;      // ex) '한식'
  const { subcategory } = req.query;    // ex) '밥'

  const params = [category];
  let sql = `
    SELECT
      id,
      business_name         AS "businessName",
      phone_number          AS "phone",
      COALESCE(image1, '')  AS "thumb",
      business_category     AS "category",
      business_subcategory  AS "subcategory"
    FROM store_info
    WHERE business_category = $1
  `;

  if (subcategory) {
    sql += ` AND business_subcategory = $2`;
    params.push(subcategory);
  }

  sql += " ORDER BY id DESC";

  try {
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error("getStoresByCategory ▶", err);
    res.status(500).json({ error: "가게 목록 조회 오류" });
  }
}

