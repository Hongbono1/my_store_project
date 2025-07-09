// controllers/storeController.js
import { pool } from "../db/pool.js";

export async function getStoreById(req, res) {
  const { id } = req.params;

  try {
    const sql = `
      SELECT
        id,
        business_name        AS "businessName",
        phone_number         AS "phone",
        image1               AS "thumbnailUrl",
        business_category    AS "category",
        business_subcategory AS "subcategory",
        address,
        event1,
        event2,
        facility,
        pets,
        parking
      FROM store_info
      WHERE id = $1
    `;
    const { rows } = await pool.query(sql, [id]);
    if (!rows.length) return res.status(404).json({ error: "not found" });
    // 👉 image1~3 컬럼을 배열로 묶어 내려줌
     res.json({
      ...rows[0],
      images: [rows[0].image1, rows[0].image2, rows[0].image3].filter(Boolean)
  });
  
  } catch (err) {
    console.error("getStoreById error:", err);
    res.status(500).json({ error: err.message });
  }
}
