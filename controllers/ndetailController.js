// controllers/storeController.js
import { pool } from "../db/pool.js";

// 1. 가게 상세정보 + 메뉴 조회
export async function getStoreDetail(req, res) {
    // 라우트 호출 여부 확인용 로그
    console.log(`[getStoreDetail] 호출됨, id=${req.params.id}`);
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
        console.log('Executing SQL:', storeQuery.trim(), [storeId]);
        const storeResult = await pool.query(storeQuery, [storeId]);
        console.log('storeResult rows:', storeResult.rows);

        const store = storeResult.rows[0];
        if (!store) {
            console.log('[getStoreDetail] 레코드 없음');
            return res.status(404).json({ success: false, message: "해당 가게 없음" });
        }

        console.log('Executing SQL:', menuQuery.trim(), [storeId]);
        const menuResult = await pool.query(menuQuery, [storeId]);
        console.log('menuResult rows count:', menuResult.rows.length);

        store.images = [store.image1, store.image2, store.image3].filter(Boolean);
        res.json({ store, menus: menuResult.rows });
    } catch (err) {
        console.error('[getStoreDetail] DB 오류:', err);
        res.status(500).json({ success: false, message: "DB 오류" });
    }
}

// server.js (혹은 app.js)
import express from 'express';
import { getStoreDetail } from './controllers/storeController.js';

const app = express();
const router = express.Router();

// 라우트 등록 예시
router.get('/store/:id', getStoreDetail);

app.use('/', router);

app.listen(3000, () => console.log('Server running on http://localhost:3000'));
