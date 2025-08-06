// controllers/storeController.js
import { pool } from "../db/pool.js";

// 1. 가게 상세정보 + 메뉴 조회
export async function getStoreDetail(req, res) {
    const storeId = req.params.id;

    // 쿼리 정의
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
        // SQL 실행 전 로깅
        console.log('Executing storeQuery:', storeQuery.trim(), [storeId]);
        const storeResult = await pool.query(storeQuery, [storeId]);
        console.log('storeResult rows:', storeResult.rows);

        const store = storeResult.rows[0];
        if (!store) {
            return res.status(404).json({ success: false, message: "해당 가게 없음" });
        }

        console.log('Executing menuQuery:', menuQuery.trim(), [storeId]);
        const menuResult = await pool.query(menuQuery, [storeId]);
        console.log('menuResult rows:', menuResult.rows.length);

        const menus = menuResult.rows;

        // 이미지 배열 생성
        store.images = [store.image1, store.image2, store.image3].filter(Boolean);

        res.json({ store, menus });
    } catch (err) {
        console.error('DB 오류:', err);
        res.status(500).json({ success: false, message: "DB 오류" });
    }
}
