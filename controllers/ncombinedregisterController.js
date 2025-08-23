// controllers/ncombinedregisterController.js
import pool from "../db.js";
import path from "path";

/** 문자열 보정: undefined/null -> "" */
const s = (v) => (v == null ? "" : String(v).trim());
/** 숫자 보정 */
const n = (v) => {
  const num = Number(String(v ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(num) ? num : 0;
};
/** boolean 보정 (가능/true/1/yes/on) */
const b = (v) => {
  const t = String(v ?? "").trim();
  return ["가능", "true", "1", "yes", "on"].includes(t.toLowerCase());
};
/** 업로드 파일 → 웹경로 */
const toWeb = (file) => (file?.path ? `/uploads/${path.basename(file.path)}` : null);

/* ----------------------
 * 저장 (등록 처리)
 * ---------------------- */
export async function createFoodStore(req, res) {
  const client = await pool.connect();
  try {
    const raw = req.body || {};
    const files = req.files || {};

    await client.query("BEGIN");

    // ✅ food_stores: address 대신 postal_code, road_address, detail_address 사용
    const storeSql = `
      INSERT INTO food_stores (
        business_name, business_type, business_category,
  business_hours, delivery_option, service_details,
  additional_desc, phone, homepage, instagram, facebook,
  facilities, pets_allowed, parking,
  postal_code, road_address, detail_address
      ) VALUES (
        $1,$2,$3,
        $4,$5,$6,
        $7,$8,$9,$10,$11,
        $12,$13,$14,
        $15,$16,$17
      )
      RETURNING id
    `;

    const storeVals = [
      s(raw.businessName),
      s(raw.businessType),
      s(raw.mainCategory || raw.subCategory),
      s(raw.businessHours),
      s(raw.deliveryOption),
      s(raw.serviceDetails),
      s(raw.additionalDesc),
      s(raw.phoneNumber),
      s(raw.homepage),
      s(raw.instagram),
      s(raw.facebook),
      s(raw.facility),
      b(raw.pets),
      s(raw.parking),
      s(raw.postalCode),
      s(raw.roadAddress),
      s(raw.detailAddress),
    ];

    const storeResult = await client.query(storeSql, storeVals);
    const storeId = storeResult.rows[0].id;

    // 대표/갤러리 이미지 (선택)
    const storeImgs = Array.isArray(files.storeImages) ? files.storeImages : [];
    for (const f of storeImgs) {
      const url = toWeb(f);
      if (!url) continue;
      await client.query(
        ` INSERT INTO store_images (store_id, url) VALUES ($1, $2)`,
        [storeId, url]
      );
    }

    // ✅ 메뉴 저장: 요청 내 중복 메뉴명 dedup (같은 이름이 오면 마지막 값으로)
    const names = Array.isArray(raw["menuName[]"])
      ? raw["menuName[]"]
      : raw.menuName
        ? [raw.menuName]
        : [];
    const prices = Array.isArray(raw["menuPrice[]"])
      ? raw["menuPrice[]"]
      : raw.menuPrice
        ? [raw.menuPrice]
        : [];
    const cats = Array.isArray(raw["menuCategory[]"]) ? raw["menuCategory[]"] : [];
    const menuImgs = Array.isArray(files["menuImage[]"]) ? files["menuImage[]"] : [];

    // 합치기
    const tmp = [];
    const len = Math.max(names.length, prices.length, cats.length, menuImgs.length);
    for (let i = 0; i < len; i++) {
      const name = s(names[i]);
      if (!name) continue;
      tmp.push({
        name,
        category: s(cats[i]) || "기타",
        price: n(prices[i]),
        image_url: toWeb(menuImgs[i]),
        description: "", // 컬럼 없으면 아래 INSERT에서 제거
      });
    }
    // dedup by name (마지막 승리)
    const byName = new Map();
    for (const m of tmp) byName.set(m.name, m);
    const menus = [...byName.values()];

    for (const m of menus) {
      await client.query(
        `
    INSERT INTO menu_items (store_id, category, name, price, image_url, description)
    VALUES ($1,$2,$3,$4,$5,$6)
    ON CONFLICT (store_id, name)
    DO UPDATE SET
      category    = EXCLUDED.category,
      price       = EXCLUDED.price,
      description = EXCLUDED.description,
      image_url   = COALESCE(EXCLUDED.image_url, menu_items.image_url)
    `,
        [storeId, m.category, m.name, m.price, m.image_url, m.description]
      );
    }

    // 이벤트 (선택)
    const ev1 = s(raw.event1);
    const ev2 = s(raw.event2);
    if (ev1) {
      await client.query(
        `INSERT INTO store_events (store_id, ord, content) VALUES ($1,$2,$3)`,
        [storeId, 1, ev1]
      );
    }
    if (ev2) {
      await client.query(
        `INSERT INTO store_events (store_id, ord, content) VALUES ($1,$2,$3)`,
        [storeId, 2, ev2]
      );
    }

    await client.query("COMMIT");
    return res.json({ ok: true, id: storeId });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[createFoodStore] error:", err);
    return res
      .status(500)
      .json({ ok: false, error: "DB insert failed", message: err.message });
  } finally {
    client.release();
  }
}

/* ----------------------
 * 조회 (상세 보기)
 * ---------------------- */
export async function getFoodStoreFull(req, res) {
  try {
    const storeId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(storeId)) {
      return res.status(400).json({ ok: false, error: "invalid_id" });
    }
    console.log("[getFoodStoreFull] storeId =", storeId);

    const { rows: storeRows } = await pool.query({
      text: `
    SELECT *, 
           (COALESCE(road_address,'') || ' ' || COALESCE(detail_address,'')) AS address
    FROM food_stores 
    WHERE id=$1
  `,
      values: [storeId],
    });

    const store = storeRows[0];

    const { rows: images } = await pool.query({
      text: `SELECT url FROM store_images WHERE store_id=$1`,
      values: [storeId],
    });

    const { rows: menus } = await pool.query({
      text: `
        SELECT category, name, price, image_url, description
        FROM menu_items
        WHERE store_id=$1
        ORDER BY category, name
      `,
      values: [storeId],             // ✅ 필수
    });

    const { rows: evRows } = await pool.query({
      text: `SELECT content FROM store_events WHERE store_id=$1 ORDER BY ord`,
      values: [storeId],
    });
    const events = evRows.map(r => r.content);

    return res.json({ ok: true, store, images, menus, events });
  } catch (err) {
    console.error("[getFoodStoreFull] error:", err);
    return res.status(500).json({ ok: false, error: "DB fetch failed", message: err.message });
  }
}

