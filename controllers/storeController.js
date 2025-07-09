// controllers/storeController.js
import { pool } from "../db/pool.js";

// 단일 가게 조회 + 메뉴까지 같이 내려주기
export async function getStoreById(req, res) {
  const { id } = req.params;

  try {
    // 가게 정보
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
        parking
      FROM store_info
      WHERE id = $1
    `;
    const { rows } = await pool.query(storeSql, [id]);
    if (!rows.length) return res.status(404).json({ error: "Store not found" });

    const store = rows[0];
    store.images = [store.image1, store.image2, store.image3].filter(Boolean);
    if (!store.images.length) {
      store.images = ["/images/no-image.png"];
    }
    store.thumbnailUrl = store.image1 || "/images/no-image.png";

    // ✅ 메뉴 정보 추가
    const menuSql = `
      SELECT
        menu_name   AS "menuName",
        menu_price  AS "menuPrice",
        category    AS "category",
        menu_image  AS "menuImageUrl"
      FROM store_menu
      WHERE store_id = $1
    `;
    const menuResult = await pool.query(menuSql, [id]);

    // ✅ store + menu 함께 내려주기
    return res.json({
      store,
      menu: menuResult.rows
    });

  } catch (err) {
    console.error("🔴 getStoreById error:", err);
    res.status(500).json({ error: err.message });
  }
}
