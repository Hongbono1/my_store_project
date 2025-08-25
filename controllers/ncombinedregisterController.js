import pool from "../db.js";
import path from "path";

/** 문자열 보정 */
const s = (v) => (v == null ? "" : String(v).trim());
/** 숫자 보정 */
const n = (v) => {
  const num = Number(String(v ?? "").replace(/[^\d]/g, ""));
  if (!Number.isFinite(num)) return 0;
  // ✅ PostgreSQL integer 최대치 제한 (2147483647)
  return Math.min(num, 2147483647);
};
/** boolean 보정 */
const b = (v) => {
  const t = String(v ?? "").trim();
  return ["가능", "true", "1", "yes", "on"].includes(t.toLowerCase());
};
/** 업로드 파일 → 웹경로 */
const toWeb = (file) => (file?.path ? `/uploads/${path.basename(file.path)}` : null);
/** 배열화 유틸 */
const arr = (v) => (Array.isArray(v) ? v : (v != null ? [v] : []));

/* ----------------------
 * 저장 (등록 처리)
 * ---------------------- */
export async function createFoodStore(req, res) {
  const client = await pool.connect();
  try {
    const raw = req.body || {};

    // files: multer.any() 또는 multer.fields() 모두 대응
    const allFiles = Array.isArray(req.files)
      ? req.files
      : Object.values(req.files || {}).flat();

    console.log("==== [createFoodStore] incoming body ====");
    console.log("menuName[]:", raw["menuName[]"]);
    console.log("menuPrice[]:", raw["menuPrice[]"]);
    console.log("menuCategory[]:", raw["menuCategory[]"]);

    await client.query("BEGIN");

    // ✅ food_stores 저장 (phone → name='phone' 사용, 불일치 보정)
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
      s(raw.mainCategory || raw.subCategory),    // 원하면 결합 문자열 사용도 가능
      s(raw.businessHours),
      s(raw.deliveryOption),
      s(raw.serviceDetails),
      s(raw.additionalDesc),
      s(raw.phone ?? raw.phoneNumber),           // ← 프론트 name='phone'
      s(raw.homepage),
      s(raw.instagram),
      s(raw.facebook),
      s(raw.facilities),                         // ← name='facilities'
      b(raw.petsAllowed),                        // ← name='petsAllowed'
      s(raw.parking),
      s(raw.postalCode),
      s(raw.roadAddress),
      s(raw.detailAddress),
    ];

    const storeResult = await client.query(storeSql, storeVals);
    const storeId = storeResult.rows[0].id;

    // ✅ 대표/갤러리 이미지 저장 (any/fields 모두 호환)
    const storeImageFiles = allFiles.filter(f => f.fieldname === "storeImages");
    for (const f of storeImageFiles) {
      const url = toWeb(f);
      if (!url) continue;
      await client.query(
        `INSERT INTO store_images (store_id, url) VALUES ($1, $2)`,
        [storeId, url]
      );
    }

    // ===================== 메뉴 저장 (menuCategory[] 우선) =====================
    const names   = arr(raw["menuName[]"]  ?? raw.menuName);
    const pricesR = arr(raw["menuPrice[]"] ?? raw.menuPrice);
    const prices  = pricesR.map((p) => n(p));

    // ★ 프론트가 행마다 넣어주는 카테고리 (가장 안전)
    const catsByRow = Array.isArray(raw["menuCategory[]"]) ? raw["menuCategory[]"] : null;

    // 메뉴 이미지 (any/fields 호환: menuImage[] 또는 menuImage)
    const menuImageFiles = allFiles.filter(
      f => f.fieldname === "menuImage[]" || f.fieldname === "menuImage"
    );
    const menuImgUrls = menuImageFiles.map((f) => toWeb(f)) ?? [];

    const menus = [];

    if (catsByRow) {
      // ✅ 새 방식: 각 행 1:1 매칭
      const len = Math.max(names.length, prices.length, catsByRow.length);
      for (let i = 0; i < len; i++) {
        const name = s(names[i]);
        if (!name) continue;
        menus.push({
          name,
          category: s(catsByRow[i]) || "기타",
          price: prices[i] ?? 0,
          image_url: menuImgUrls[i] || null,
          description: "",
        });
      }
    } else {
      // ✅ 구방식 fallback: menuCount_*로 카테고리별 개수 복구
      const catNames = arr(raw["categoryName[]"] ?? raw.categoryName);
      let k = 0;
      for (let ci = 0; ci < catNames.length; ci++) {
        const cat = s(catNames[ci]) || "기타";
        const count = Number(raw[`menuCount_${ci}`] || 0);
        for (let j = 0; j < count; j++, k++) {
          const name = s(names[k]);
          if (!name) continue;
          menus.push({
            name,
            category: cat,
            price: prices[k] ?? 0,
            image_url: menuImgUrls[k] || null,
            description: "",
          });
        }
      }
    }

    // (선택) 과거 오염 데이터가 있다면 전량 교체하고 싶을 때 주석 해제
    // await client.query(`DELETE FROM menu_items WHERE store_id=$1`, [storeId]);

    // ✅ DB upsert
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
    // ===================== 메뉴 저장 끝 =======================================

    // ✅ 이벤트
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
    console.log("[createFoodStore] 성공:", storeId);
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

    // ✅ store_images.url 기준
    const { rows: images } = await pool.query({
      text: `SELECT url FROM store_images WHERE store_id=$1 ORDER BY sort_order, id`,
      values: [storeId],
    });

    const { rows: menus } = await pool.query({
      text: `
        SELECT category, name, price, image_url, description
        FROM menu_items
        WHERE store_id=$1
        ORDER BY category, name
      `,
      values: [storeId],
    });

    const { rows: evRows } = await pool.query({
      text: `SELECT content FROM store_events WHERE store_id=$1 ORDER BY ord`,
      values: [storeId],
    });
    const events = evRows.map((r) => r.content);

    return res.json({ ok: true, store, images, menus, events });
  } catch (err) {
    console.error("[getFoodStoreFull] error:", err);
    return res
      .status(500)
      .json({ ok: false, error: "DB fetch failed", message: err.message });
  }
}
