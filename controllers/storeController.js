// controllers/storeController.js
import { pool } from "../db/pool.js";

/**
 * 단일 가게 상세 조회 + 메뉴 목록
 * GET /store/:id
 */
export async function getStoreById(req, res) {
  const { id } = req.params;           // 예: 14

  try {
    /* ───────────────────────────────────────────────
     * 1) 가게 기본 정보
     * ───────────────────────────────────────────── */
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

    /* 1-a) 전처리: 이미지 · 이벤트 등 배열로 변환 */
    store.images       = [store.image1, store.image2, store.image3].filter(Boolean);
    if (!store.images.length) store.images = ["/images/no-image.png"];

    store.thumbnailUrl = store.image1 || "/images/no-image.png";
    store.events       = [store.event1, store.event2].filter(Boolean);
    store.additionalDescription = store.description || "";

    /* ───────────────────────────────────────────────
     * 2) 메뉴 정보
     * ───────────────────────────────────────────── */
    const menuSql = `
      SELECT
        id,
        category,
        menu_name  AS "menuName",
        menu_price AS "menuPrice"
        menu_image AS "menu_image"
      FROM store_menu
      WHERE store_id = $1
      ORDER BY id
    `;
    const { rows: menus } = await pool.query(menuSql, [id]);

    /* ───────────────────────────────────────────────
     * 3) 응답
     * ───────────────────────────────────────────── */
    return res.json({ store, menus });
  } catch (err) {
    console.error("🔴 getStoreById error:", err);
    res.status(500).json({ error: err.message });
  }
}
