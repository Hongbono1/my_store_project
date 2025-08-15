// controllers/foodregisterController.js
import pool from "../db.js";
import path from "path";

// 공통: 숫자 ID 가드
function parseId(raw) {
  const n = Number.parseInt(raw, 10);
  return Number.isSafeInteger(n) ? n : null;
}

/**
 * 등록: FormData (multipart/form-data)
 * 필수: businessName, roadAddress
 * 선택: phone, storeImages[*], storeMenus[i][j][{category|name|price}]
 *       + 확장 필드(업종/카테고리/영업시간/배달/서비스/이벤트/기타/연락처 등)
 * 응답: { ok:true, id }
 */
export async function createFoodStore(req, res) {
  const client = await pool.connect();
  try {
    const businessName = (req.body.businessName || "").trim();
    const roadAddress  = (req.body.roadAddress  || "").trim();
    const phone        = (req.body.phone        || "").trim();

    if (!businessName || !roadAddress) {
      return res.status(400).json({ ok: false, error: "businessName, roadAddress는 필수" });
    }

    // 확장 필드들 (폼 name과 1:1)
    const businessType     = (req.body.businessType     || "").trim();
    const businessCategory = (req.body.businessCategory || "").trim();
    const businessHours    = (req.body.businessHours    || "").trim();
    const deliveryOption   = (req.body.deliveryOption   || "").trim();

    const serviceDetails   = (req.body.serviceDetails   || "").trim();
    const additionalDesc   = (req.body.additionalDesc   || "").trim();

    const homepage         = (req.body.homepage         || "").trim();
    const instagram        = (req.body.instagram        || "").trim();
    const facebook         = (req.body.facebook         || "").trim();

    const facilities       = (req.body.facilities       || "").trim();
    const petsAllowed =
      req.body.petsAllowed === "true" ? true :
      req.body.petsAllowed === "false" ? false : null;
    const parking          = (req.body.parking          || "").trim();

    await client.query("BEGIN");

    // 1) 가게 기본 + 확장 저장
    const insertStoreQ = `
      INSERT INTO food_stores (
        business_name, road_address, phone,
        business_type, business_category, business_hours, delivery_option,
        service_details, additional_desc,
        homepage, instagram, facebook,
        facilities, pets_allowed, parking
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      RETURNING id
    `;
    const { rows } = await client.query(insertStoreQ, [
      businessName, roadAddress, phone || null,
      businessType || null, businessCategory || null, businessHours || null, deliveryOption || null,
      serviceDetails || null, additionalDesc || null,
      homepage || null, instagram || null, facebook || null,
      facilities || null, petsAllowed, parking || null
    ]);
    const storeId = rows[0].id;

    // 2) 이미지 저장 (multer.diskStorage 기준)
    //   라우터가 upload.array("storeImages", 10) 이면 req.files가 배열임
    //   any()를 쓴 경우도 대비해서 둘 다 처리
    const files = Array.isArray(req.files) ? req.files : (req.files?.storeImages || []);
    if (files && files.length) {
      const urls = files
        .map(f => (f.path ? `/uploads/${path.basename(f.path)}`
                          : f.filename ? `/uploads/${f.filename}` : null))
        .filter(Boolean);
      if (urls.length) {
        const values = urls.map((_, i) => `($1,$${i + 2})`).join(",");
        await client.query(
          `INSERT INTO store_images (store_id, url) VALUES ${values}`,
          [storeId, ...urls]
        );
      }
    }

    // 3) 메뉴 저장 (FormData 평탄화: storeMenus[i][j][category|name|price])
    const menuBuckets = {};
    for (const [k, v] of Object.entries(req.body)) {
      const m = k.match(/^storeMenus\[(\d+)\]\[(\d+)\]\[(category|name|price)\]$/);
      if (!m) continue;
      const [, ci, mi, key] = m;
      const idx = `${ci}:${mi}`;
      menuBuckets[idx] ??= { category: null, name: "", price: 0 };
      if (key === "price") {
        menuBuckets[idx].price = parseInt(String(v).replace(/[^\d]/g, ""), 10) || 0;
      } else if (key === "name") {
        menuBuckets[idx].name = String(v).trim();
      } else if (key === "category") {
        menuBuckets[idx].category = String(v).trim() || null;
      }
    }
    const menus = Object.values(menuBuckets).filter(m => m.name && m.price > 0);
    if (menus.length) {
      const vals = menus.map((_, i) => `($1,$${i*3+2},$${i*3+3},$${i*3+4})`).join(",");
      const params = [storeId];
      menus.forEach(m => { params.push(m.name, m.price, m.category); });
      await client.query(
        `INSERT INTO menu_items (store_id, name, price, category) VALUES ${vals}`,
        params
      );
    }

    // 4) 이벤트 저장 (event1, event2 … 같은 단건 필드들 수집)
    const events = Object.entries(req.body)
      .filter(([k]) => /^event\d+$/.test(k))
      .map(([, v]) => String(v || "").trim())
      .filter(Boolean);
    if (events.length) {
      const values = events.map((_, i) => `($1,$${i+2},${i})`).join(",");
      await client.query(
        `INSERT INTO store_events (store_id, content, ord) VALUES ${values}`,
        [storeId, ...events]
      );
    }

    await client.query("COMMIT");
    return res.json({ ok: true, id: storeId });
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch {}
    console.error("[createFoodStore] error:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  } finally {
    client.release();
  }
}

/**
 * 기본 조회: /foodregister/:id
 * 응답: { ok:true, store:{...} } | 404
 */
export async function getFoodStoreById(req, res) {
  try {
    const idNum = parseId(req.params.id);
    if (!idNum) return res.status(400).json({ ok: false, error: "Invalid id" });

    const q = `
      SELECT
        id,
        business_name AS "businessName",
        road_address  AS "roadAddress",
        phone,
        created_at    AS "createdAt"
      FROM food_stores
      WHERE id = $1
    `;
    const { rows } = await pool.query(q, [idNum]);
    if (!rows.length) return res.status(404).json({ ok: false, error: "not_found" });

    return res.json({ ok: true, store: rows[0] });
  } catch (err) {
    console.error("[getFoodStoreById] error:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
}

/**
 * 풀 상세: /foodregister/:id/full
 * - ndetail.html이 기대하는 구조(store, images[], menus[], events[])로 응답
 */
export async function getFoodRegisterFull(req, res) {
  try {
    const idNum = parseId(req.params.id);
    if (!idNum) return res.status(400).json({ ok: false, error: "Invalid id" });

    // 1) 가게(road_address → address 별칭으로)
    const { rows: s } = await pool.query(
      `SELECT
         id,
         business_name,
         road_address AS address,
         phone, created_at,
         business_type, business_category, business_hours, delivery_option,
         service_details, additional_desc,
         homepage, instagram, facebook,
         facilities, pets_allowed, parking
       FROM food_stores
       WHERE id = $1`,
      [idNum]
    );
    if (!s.length) return res.status(404).json({ ok: false, error: "not_found" });

    // 2) 이미지
    const { rows: images } = await pool.query(
      `SELECT id, url
         FROM store_images
        WHERE store_id = $1
        ORDER BY id ASC`,
      [idNum]
    );

    // 3) 메뉴
    const { rows: menus } = await pool.query(
      `SELECT id, name, price,
              COALESCE(category,'기타') AS category,
              image_url
         FROM menu_items
        WHERE store_id = $1
        ORDER BY id ASC`,
      [idNum]
    );

    // 4) 이벤트
    const { rows: ev } = await pool.query(
      `SELECT content
         FROM store_events
        WHERE store_id = $1
        ORDER BY ord, id`,
      [idNum]
    );

    return res.json({
      ok: true,
      store: s[0],
      images,
      menus,
      events: ev.map(x => x.content)
    });
  } catch (err) {
    console.error("[getFoodRegisterFull] error:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
}
