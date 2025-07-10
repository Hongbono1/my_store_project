export async function getStoresBySubcategory(req, res) {
  const { sub } = req.params;  // ex) '밥'

  const sql = `
    SELECT
      id,
      business_name         AS "businessName",
      phone_number          AS "phone",
      COALESCE(image1,'')   AS "thumb",
      business_category     AS "category",
      business_subcategory  AS "subcategory"
    FROM store_info
    WHERE business_subcategory = $1
    ORDER BY id DESC
  `;

  const { rows } = await pool.query(sql, [sub]);
  res.json(rows);
}
