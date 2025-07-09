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
    res.json(rows[0]);
  } catch (err) {
    console.error("getStoreById error:", err);
    res.status(500).json({ error: err.message });
  }
}
