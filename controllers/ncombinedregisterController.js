import pool from "../db.js";
import path from "path";

/* ----------------------
 * 저장 (등록 처리)
 * ---------------------- */
export async function createFoodStore(req, res) {
  try {
    const raw = req.body;
    const files = req.files;

    // 1) 기본 가게 정보 저장
    const storeSql = `
      INSERT INTO food_stores
        (business_name, business_type, business_category,
         business_hours, delivery_option, service_details,
         additional_desc, phone, homepage, instagram, facebook,
         facilities, pets_allowed, parking, address)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      RETURNING id
    `;
    const values = [
      raw.businessName,
      raw.businessType,
      raw.mainCategory,
      raw.businessHours,
      raw.deliveryOption,
      raw.serviceDetails,
      raw.additionalDesc,
      raw.phoneNumber,
      raw.homepage,
      raw.instagram,
      raw.facebook,
      raw.facility,
      raw.pets === "가능",
      raw.parking,
      raw.roadAddress
    ];
    const { rows } = await pool.query(storeSql, values);
    const storeId = rows[0].id;

    // 2) 이미지 저장
    if (files?.storeImages) {
      for (const f of files.storeImages) {
        await pool.query(
          `INSERT INTO food_store_images (store_id, url) VALUES ($1, $2)`,
          [storeId, `/uploads/${path.basename(f.path)}`]
        );
      }
    }

    // 3) 메뉴 저장
    const names = Array.isArray(raw["menuName[]"]) ? raw["menuName[]"] : [];
    const prices = Array.isArray(raw["menuPrice[]"]) ? raw["menuPrice[]"] : [];
    const cats = Array.isArray(raw["menuCategory[]"]) ? raw["menuCategory[]"] : [];
    for (let i = 0; i < names.length; i++) {
      await pool.query(
        `INSERT INTO food_menu_items (store_id, category, name, price)
         VALUES ($1,$2,$3,$4)`,
        [storeId, cats[i] || "기타", names[i], Number(prices[i] || 0)]
      );
    }

    res.json({ ok: true, id: storeId });
  } catch (err) {
    console.error("[createFoodStore] error:", err);
    res.status(500).json({ ok: false, error: "DB insert failed" });
  }
}

/* ----------------------
 * 조회 (상세 보기)
 * ---------------------- */
export async function getFoodStoreFull(req, res) {
  try {
    const storeId = parseInt(req.params.id, 10);

    const store = (await pool.query(
      `SELECT * FROM food_stores WHERE id=$1`, [storeId]
    )).rows[0];

    const images = (await pool.query(
      `SELECT url FROM food_store_images WHERE store_id=$1`, [storeId]
    )).rows;

    const menus = (await pool.query(
      `SELECT category, name, price, image_url, description
       FROM food_menu_items WHERE store_id=$1 ORDER BY category`, [storeId]
    )).rows;

    const events = (await pool.query(
      `SELECT content FROM store_events WHERE store_id=$1 ORDER BY ord`, [storeId]
    )).rows.map(r => r.content);

    res.json({ ok: true, store, images, menus, events });
  } catch (err) {
    console.error("[getFoodStoreFull] error:", err);
    res.status(500).json({ ok: false, error: "DB fetch failed" });
  }
}
