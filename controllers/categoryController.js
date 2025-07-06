// controllers/categoryController.js
import { pool } from "../db/pool.js";

export async function getCategories(req, res) {
  try {
    res.json(["식사", "분식", "카페"]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "서버 오류" });
  }
}

/* ✅ 카테고리별 가게 목록:  GET /store?category=한식 에 대응 */
export async function getStoresByCategory(req, res) {
  const { category } = req.query;          // ← query 로 받음

  try {

    if (isNaN(id)) {
      // 카테고리 이름 (문자)
      const { rows } = await pool.query(`
        SELECT
          id,
          business_name AS "businessName",
          phone_number AS "phone",
          image1
        FROM store_info
        WHERE business_category = $1
      `, [id]);

      res.json(rows);

    } else {
      // 숫자: 단일 가게 상세
      const { rows } = await pool.query(`
        SELECT
          id,
          business_name AS "businessName",
          phone_number AS "phone",
          image1,
          image2,
          image3
        FROM store_info
        WHERE id = $1
      `, [Number(id)]);

      if (rows.length === 0) {
        res.status(404).json({ error: "가게를 찾을 수 없음" });
      } else {
        res.json(rows[0]);  // 단일 가게니까 rows[0]!
      }
    }

    const { rows } = await pool.query(
      `
      SELECT
        id,
        business_name AS "businessName",
        phone_number  AS "phone",
        image1
      FROM store_info
      WHERE business_category = $1
      `,
      [category]
    );

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "서버 오류" });
  }
}
