import { pool } from "../db/pool.js";

/**
 * ▣ 단일 가게 상세 조회 + 메뉴 목록
 * GET /store/:id
 */
export async function getStoreById(req, res) {
  const { id } = req.params;

  try {
    const storeSql = `
      SELECT
        id,
        business_name        AS "businessName",
        phone_number         AS "phone",
        image1,
        image2,
        image3,
        business_category    AS "category",
        business_subcategory AS "subcategory",
        address,
        event1,
        event2,
        facility,
        pets,
        parking,
        service_details      AS "serviceDetails",
        homepage,
        instagram,
        facebook,
        description
      FROM store_info
      WHERE id = $1
    `;
    const { rows } = await pool.query(storeSql, [id]);
    if (!rows.length) return res.status(404).json({ error: "Store not found" });

    const store = rows[0];
    store.images = [store.image1, store.image2, store.image3].filter(Boolean);
    if (!store.images.length) store.images = ["/images/no-image.png"];
    store.thumbnailUrl = store.image1 || "/images/no-image.png";
    store.events = [store.event1, store.event2].filter(Boolean);
    store.additionalDescription = store.description || "";

    // 메뉴 정보
    const menuSql = `
      SELECT
        id,
        category,
        menu_name  AS "menuName",
        menu_price AS "menuPrice",
        menu_image AS "menu_image"
      FROM store_menu
      WHERE store_id = $1
      ORDER BY id
    `;
    const { rows: menus } = await pool.query(menuSql, [id]);

    return res.json({ store, menus });
  } catch (err) {
    console.error("🔴 getStoreById error:", err);
    res.status(500).json({ error: err.message });
  }
}

/**
 * ▣ 여러 가게 리스트 조회 (업종, 카테고리)
 * GET /store?category=밥&type=한식
 */
/**
 * ▣ 여러 가게 리스트 조회 (카테고리·서브카테고리)
 *    예) /store?category=한식&subcategory=밥
 */
export async function getStores(req, res) {
  const { category, subcategory } = req.query;

  let sql = `
    SELECT
      id,
      business_name        AS "businessName",
      business_category    AS "category",
      business_subcategory AS "subcategory",
      phone_number         AS "phone",
      image1               AS "thumb",
      address
    FROM store_info
    WHERE 1 = 1
  `;

  const params   = [];
  let   paramIdx = 1;          // ✅ 한 변수만 사용!

  if (category) {
    sql += ` AND business_category = $${paramIdx++}`;
    params.push(category.trim());
  }

  if (subcategory) {
    sql += ` AND business_subcategory = $${paramIdx++}`;
    params.push(subcategory.trim());
  }

  sql += " ORDER BY id DESC";

  try {
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error("❌ getStores error:", err);
    res.status(500).json({ error: err.message });
  }
}
