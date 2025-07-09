// controllers/storeController.js
import pool from "../db/pool.js";           // ← DB 풀 경로 확인!

/**
 * GET /store/:id
 * 가게 기본 정보 + 메뉴 목록 반환
 */
export async function getStoreById(req, res) {
  const { id } = req.params;

  try {
    /* 1) 가게 정보 */
    const storeQ = await pool.query(
      `
      SELECT
        id,
        business_name        AS "businessName",
        phone,
        image1, image2, image3,
        category,
        subcategory,
        address,
        event1, event2,
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
      `,
      [id]
    );

    /* 2) 메뉴 정보 */
    const menuQ = await pool.query(
      `
      SELECT
        id,
        category,
        menu_name   AS "menuName",
        menu_price  AS "menuPrice",
        menu_image  AS "menu_image"
      FROM store_menu
      WHERE store_id = $1
      ORDER BY id
      `,
      [id]
    );

    /* 3) 가게 이미지 배열 구성 */
    const store = storeQ.rows[0] ?? {};
    store.images = [store.image1, store.image2, store.image3].filter(Boolean);
    store.thumbnailUrl = store.image1 || null;

    /* 4) 응답 */
    return res.json({
      store,
      menus: menuQ.rows          // ✅ menus 포함!
    });
  } catch (err) {
    console.error("[controllers/store] getStoreById error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
