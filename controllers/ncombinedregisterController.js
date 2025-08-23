// controllers/ncombinedregisterController.js
import pool from "../db.js";
import path from "path";

const asArray = (v) => (Array.isArray(v) ? v : (v != null ? [v] : []));

/* ----------------------
 * 저장 (등록 처리)
 * ---------------------- */
export async function createFoodStore(req, res) {
  try {
    const raw = req.body;
    const files = req.files || {};

    // 1) 기본 가게 정보 저장
    //   - mainCategory → business_type
    //   - subCategory  → business_category
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
      raw.businessName || null,
      raw.mainCategory || null,
      raw.subCategory || null,
      raw.businessHours || null,
      raw.deliveryOption || null,
      raw.serviceDetails || null,
      raw.additionalDesc || null,
      raw.phoneNumber || null,
      raw.homepage || null,
      raw.instagram || null,
      raw.facebook || null,
      raw.facility || null,
      (raw.pets || "").trim() === "가능",
      raw.parking || null,
      raw.roadAddress || raw.ownerAddress || null,
    ];
    const { rows } = await pool.query(storeSql, values);
    const storeId = rows[0].id;

    // 2) 가게 이미지 저장 (옵션)
    const storeImages = files["storeImages"] || [];
    for (const f of storeImages) {
      await pool.query(
        `INSERT INTO food_store_images (store_id, url) VALUES ($1, $2)`,
        [storeId, `/uploads/${path.basename(f.path)}`]
      );
    }

    // 3) 메뉴 저장
    // 프론트에서 name="menuName[]", "menuPrice[]", "menuCategory[]", "menuImage[]"
    const names  = asArray(raw["menuName[]"]);
    const prices = asArray(raw["menuPrice[]"]);
    const cats   = asArray(raw["menuCategory[]"]);      // 카테고리 히든필드(프론트에서 생성)
    const menuImgs = files["menuImage[]"] || [];        // 파일 배열(인덱스 매칭)

    for (let i = 0; i < names.length; i++) {
      const name = names[i] || "";
      const priceNum = Number(String(prices[i] ?? 0).replace(/[^\d.-]/g, "")) || 0;
      const cat = (cats[i] || "기타").toString().trim() || "기타";
      const img = menuImgs[i] ? `/uploads/${path.basename(menuImgs[i].path)}` : null;

      await pool.query(
        `INSERT INTO food_menu_items (store_id, category, name, price, image_url)
         VALUES ($1,$2,$3,$4,$5)`,
        [storeId, cat, name, priceNum, img]
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
       FROM food_menu_items
       WHERE store_id=$1
       ORDER BY category, name`, [storeId]
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
