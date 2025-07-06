// controllers/categoryController.js
import { pool } from "../db/pool.js";

export async function getCategories(req, res) {
  try {
    // 예시: DB에서 SELECT 또는 상수
    res.json(["식사", "분식", "카페"]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "서버 오류" });
  }
}

export async function getStoresByCategory(req, res) {
  const { id } = req.params;

  try {
    let query = "";
    let values = [];

    if (isNaN(id)) {
      // ✅ 숫자가 아니면 카테고리 이름으로
      query = `
        SELECT
          id,
          business_name AS "businessName",
          phone_number AS "phone",
          image1
        FROM store_info
        WHERE business_category = $1
      `;
      values = [id];
    } else {
      // ✅ 숫자면 id로 단일 가게
      const storeQ = await pool.query(`
        SELECT
          id,
          business_name       AS "businessName",
          phone_number        AS "phone",
          image1              AS "image1",
          image2              AS "image2",
          image3              AS "image3"
        FROM store_info
         WHERE id = $1
        `, [id]);
      values = [Number(id)];
    }

    const { rows } = await pool.query(query, values);
    res.json(rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "서버 오류" });
  }
}
