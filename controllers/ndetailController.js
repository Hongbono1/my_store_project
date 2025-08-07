import { pool } from "../db/pool.js";

/**
 * GET /store/:id
 * 상세 정보 + 메뉴 조회 (DB 기반)
 */
export async function getStoreDetail(req, res) {
  console.log(`[getStoreDetail] 호출, id=${req.params.id}`);
  const storeId = req.params.id;

  const storeQuery = `
    SELECT
      id,
      owner_id AS "ownerId",
      business_name AS "businessName",
      business_type AS "businessType",
      delivery_option AS "deliveryOption",
      business_hours AS "businessHours",
      service_details AS "serviceDetails",
      event1, event2,
      facility, pets, parking,
      phone_number AS "phoneNumber",
      homepage, instagram, facebook,
      additional_desc AS "additionalDesc",
      address,
      image1, image2, image3,
      created_at AS "createdAt",
      business_category AS "businessCategory",
      business_subcategory AS "businessSubcategory",
      description,
      search_count AS "searchCount",
      view_count AS "viewCount",
      click_count AS "clickCount"
    FROM store_info
    WHERE id = $1
  `;

  const menuQuery = `
    SELECT id, store_id, menu_name, menu_price, menu_image, category
    FROM store_menu
    WHERE store_id = $1
  `;

  try {
    console.log("SQL:", storeQuery.trim(), [storeId]);
    const storeResult = await pool.query(storeQuery, [storeId]);

    const store = storeResult.rows[0];
    if (!store) {
      console.log("[getStoreDetail] 레코드 없음");
      return res.status(404).json({ success: false, message: "해당 가게 없음" });
    }

    console.log("SQL:", menuQuery.trim(), [storeId]);
    const menuResult = await pool.query(menuQuery, [storeId]);

    // 이미지 배열 정리
    store.images = [store.image1, store.image2, store.image3].filter(Boolean);

    return res.json({ store, menus: menuResult.rows });
  } catch (err) {
    console.error("[getStoreDetail] DB 오류:", err);
    return res.status(500).json({ success: false, message: "DB 오류" });
  }
}
