// controllers/storeController.js
import { pool } from "../db/pool.js";

// 1. 가게 상세정보 + 메뉴 조회
export async function getStoreDetail(req, res) {
    const storeId = req.params.id;
    try {
        const storeQuery = `
      SELECT
        id, business_name, business_type, delivery_option, business_hours,
        service_details, event1, event2, facility, pets, parking, phone_number,
        homepage, instagram, facebook, additional_desc, address, image1, image2, image3,
        business_category, business_subcategory, description, search_count, view_count, click_count
      FROM store_info
      WHERE id = $1
    `;
        const storeResult = await pool.query(storeQuery, [storeId]);
        const store = storeResult.rows[0];

        if (!store) return res.status(404).json({ success: false, message: "해당 가게 없음" });

        const menuQuery = `
      SELECT id, store_id, menu_name, menu_price, menu_image, category
      FROM store_menu
      WHERE store_id = $1
    `;
        const menuResult = await pool.query(menuQuery, [storeId]);
        const menus = menuResult.rows;

        // 이미지 배열 추가
        store.images = [store.image1, store.image2, store.image3].filter(Boolean);

        res.json({ store, menus });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "DB 오류" });
    }
}
