// controllers/foodregisterController.js
import pool from "../db.js";
import path from "path";



/* ===================== 공통 유틸 ===================== */
function parseEventsFrom(req) {
  const raw = (req && req.body) ? req.body : {};
  return Object.entries(raw)
    .filter(([k]) => /^event\d+$/i.test(k))
    .map(([, v]) => String(v || "").trim())
    .filter(Boolean);
}

function parseId(raw) {
  const n = Number.parseInt(String(raw), 10);
  return Number.isSafeInteger(n) ? n : null;
}

function collectFiles(req) {
  if (!req || !req.files) return [];
  if (Array.isArray(req.files)) return req.files; // upload.any()
  return Object.values(req.files).flat();        // upload.fields()
}

function filesByField(files, ...fieldnames) {
  const set = new Set(fieldnames);
  return files.filter((f) => set.has(f.fieldname));
}

function toWebPath(f) {
  return f?.path
    ? `/uploads/${path.basename(f.path)}`
    : f?.filename
      ? `/uploads/${f.filename}`
      : null;
}

// "12,000원" → 12000
function toInt(v) {
  if (v == null) return 0;
  const n = String(v).replace(/[^\d]/g, "");
  return n ? parseInt(n, 10) : 0;
}

/* ===== 메뉴 파싱 유틸: 신규 브래킷 + 구형 배열 ===== */
function extractMenusFromBody(body) {
  const out = [];
  const pushItem = (m) => {
    if (!m) return;
    const name = (m.name ?? "").trim();
    const price = toInt(m.price);
    if (!name || price <= 0) return;
    out.push({
      name,
      price,
      category: (m.category ?? "").trim() || null,
      description: (m.description ?? "").trim() || null,
      image_url: (m.image_url ?? "").trim() || null,
    });
  };

  // (A) 중첩 객체/배열: body.storeMenus[*][*]
  const sm = body?.storeMenus;
  if (sm && typeof sm === "object") {
    const groups = Array.isArray(sm) ? sm : Object.values(sm);
    groups.forEach((g) => {
      const items = Array.isArray(g) ? g : Object.values(g || {});
      items.forEach(pushItem);
    });
  }

  // (B) 브래킷 키: storeMenus[i][j][field]
  const buckets = {};
  for (const [k, v] of Object.entries(body || {})) {
    const m = k.match(/^storeMenus\[(\d+)\]\[(\d+)\]\[(category|name|price|description|image_url)\]$/);
    if (!m) continue;
    const idx = `${m[1]}:${m[2]}`;
    (buckets[idx] ||= { category: null, name: "", price: 0, description: "", image_url: null });
    const val = String(v ?? "").trim();
    if (m[3] === "price") buckets[idx].price = toInt(val);
    else if (m[3] === "category") buckets[idx].category = val || null;
    else buckets[idx][m[3]] = val;
  }
  Object.values(buckets).forEach(pushItem);

  return out;
}

// (구형) menuName[] / menuPrice[] / menuCategory[] / menuDesc[] + menuImage[] 파일
function extractLegacyMenusFromBody(body, menuFiles = []) {
  const toArr = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
  const names = toArr(body["menuName[]"] ?? body.menuName);
  const prices = toArr(body["menuPrice[]"] ?? body.menuPrice);
  const cats = toArr(body["menuCategory[]"] ?? body.menuCategory);
  const descs = toArr(body["menuDesc[]"] ?? body.menuDesc);
  const maxLen = Math.max(names.length, prices.length, cats.length, descs.length, menuFiles.length);
  const rows = [];
  for (let i = 0; i < maxLen; i++) {
    const name = (names[i] ?? "").trim();
    const price = toInt(prices[i]);
    const category = (cats[i] ?? "").trim() || null;
    const description = (descs[i] ?? "").trim() || null;
    const img = menuFiles[i] ? toWebPath(menuFiles[i]) : null;
    if (name && price > 0) rows.push({ name, price, category, description, image_url: img });
  }
  return rows;
}

/* ===================== 등록(POST) ===================== */
export async function createFoodStore(req, res) {
  const client = await pool.connect();
  try {
    const businessName = (req.body.businessName || "").trim();
    const roadAddress = (req.body.roadAddress || "").trim();
    const phone = (req.body.phone || "").trim();

    if (!businessName || !roadAddress) {
      return res.status(200).json({
        ok: false,
        error: "missing_required",
        fields: { businessName: !!businessName, roadAddress: !!roadAddress },
      });
    }

    const businessType = (req.body.businessType || "").trim();
    const businessCategory = (req.body.businessCategory || "").trim();
    const businessHours = (req.body.businessHours || "").trim();
    const deliveryOption = (req.body.deliveryOption || "").trim();

    const serviceDetails = (req.body.serviceDetails || "").trim();
    const additionalDesc = (req.body.additionalDesc || "").trim();

    const homepage = (req.body.homepage || "").trim();
    const instagram = (req.body.instagram || "").trim();
    const facebook = (req.body.facebook || "").trim();

    const facilities = (req.body.facilities || "").trim();
    const petsAllowed =
      req.body.petsAllowed === "true"
        ? true
        : req.body.petsAllowed === "false"
          ? false
          : null;
    const parking = (req.body.parking || "").trim();

    await client.query("BEGIN");

    // 1) 가게
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
      businessName,
      roadAddress,
      phone || null,
      businessType || null,
      businessCategory || null,
      businessHours || null,
      deliveryOption || null,
      serviceDetails || null,
      additionalDesc || null,
      homepage || null,
      instagram || null,
      facebook || null,
      facilities || null,
      petsAllowed,
      parking || null,
    ]);
    const storeId = rows[0].id;

    // 2) 파일 분류
    const allFiles = collectFiles(req);
    const storeImageFiles = filesByField(allFiles, "storeImages", "storeImages[]");
    const menuImgFiles = filesByField(allFiles, "menuImage[]", "menuImage");
    // const certFile = filesByField(allFiles, "businessCertImage")[0];

    // 2-1) 대표 이미지 저장(단일화: store_images)
    if (storeImageFiles.length) {
      const urls = storeImageFiles.map(toWebPath).filter(Boolean);
      if (urls.length) {
        const values = urls.map((_, i) => `($1,$${i + 2})`).join(",");
        await client.query(
          `INSERT INTO store_images (store_id, url) VALUES ${values}`,
          [storeId, ...urls]
        );
      }
    }

    // 3) 메뉴 저장(신규 브래킷 + 구형 배열 병합 → menu_items)
    const menusA = extractMenusFromBody(req.body);
    const menusB = extractLegacyMenusFromBody(req.body, menuImgFiles); // ← 이미지 포함
    const menus = [...menusA, ...menusB];

    await client.query(`DELETE FROM menu_items WHERE store_id=$1`, [idNum]);

    if (menus.length) {
      const vals = menus
        .map(
          (_, i) =>
            `($1,$${i * 5 + 2},$${i * 5 + 3},$${i * 5 + 4},$${i * 5 + 5},$${i * 5 + 6})`
        )
        .join(",");

      const params = menus.flatMap(m => [
        m.name,                  // name
        m.price,                 // price
        m.category,              // category
        m.image_url || null,     // image_url
        m.description || null    // description
      ]);

      await client.query(
        `INSERT INTO menu_items (store_id, name, price, category, image_url, description) VALUES ${vals}`,
        [idNum, ...params]
      );
    }

    // 4) 이벤트 저장
    const events = parseEventsFrom(req);
    if (events.length) {
      const values = events.map((_, i) => `($1,$${i + 2},${i})`).join(",");
      await client.query(
        `INSERT INTO store_events (store_id, content, ord) VALUES ${values}`,
        [storeId, ...events]
      );
    }

    await client.query("COMMIT");

    const toSafeInt = (v) => (Number.isSafeInteger(v) ? v : Number.parseInt(v, 10));
    return res.status(200).json({ ok: true, id: toSafeInt(storeId) || Date.now() });
  } catch (err) {
    try { if (client) await client.query("ROLLBACK"); } catch { }
    console.error("[createFoodStore] error:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  } finally {
    try { if (client) client.release(); } catch { }
  }
}

/* ===================== 단건 조회(GET /:id) ===================== */
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
        NULL::timestamp AS "createdAt"
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

/* ===================== 풀 상세(GET /:id/full) ===================== */
export async function getFoodRegisterFull(req, res) {
  try {
    const idNum = parseId(req.params.id);
    if (!idNum) return res.status(400).json({ ok: false, error: "Invalid id" });

    // 1) 가게
    const { rows: s } = await pool.query(
      `SELECT
         id,
         business_name,
         road_address AS address,
         phone,
         NULL::timestamp AS created_at,
         business_type, business_category, business_hours, delivery_option,
         service_details, additional_desc,
         homepage, instagram, facebook,
         facilities, pets_allowed, parking
       FROM food_stores
       WHERE id = $1`,
      [idNum]
    );
    if (!s.length) return res.status(404).json({ ok: false, error: "not_found" });

    // 2) 이미지 → store_images만 사용
    const { rows: images } = await pool.query(
      `SELECT url 
         FROM store_images
        WHERE store_id = $1
        ORDER BY sort_order, id`,
      [idNum]
    );

    // 3) 메뉴
    const { rows: menus } = await pool.query(
      `SELECT store_id, COALESCE(category,'기타') AS category,
              name, price, image_url, description
         FROM menu_items
        WHERE store_id = $1
        ORDER BY category, name, price`,
      [idNum]
    );

    // 4) 이벤트
    const { rows: ev } = await pool.query(
      `SELECT content FROM store_events WHERE store_id = $1 ORDER BY ord, id`,
      [idNum]
    );

    return res.json({
      ok: true,
      store: s[0],
      images, // [{url: "..."}]
      menus,  // [{category, name, price, image_url, description}]
      events: ev.map((x) => x.content),
    });
  } catch (err) {
    console.error("[getFoodRegisterFull] error:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
}

/* ===================== 수정(PUT /:id) ===================== */
export async function updateFoodStore(req, res) {
  const client = await pool.connect();
  try {
    const idNum = parseId(req.params.id);
    if (!idNum) return res.status(400).json({ ok: false, error: "Invalid id" });

    const raw = req.body;
    const events = Object.entries(raw)
      .filter(([k]) => /^event\d+$/i.test(k))
      .map(([, v]) => String(v || "").trim())
      .filter(Boolean);
    const mapBool = (v) =>
      v === true || v === "true" ? true : v === false || v === "false" ? false : null;

    const candidate = {
      business_name: raw.businessName?.trim(),
      road_address: raw.roadAddress?.trim(),
      phone: raw.phone?.trim(),
      business_type: raw.businessType?.trim(),
      business_category: raw.businessCategory?.trim(),
      business_hours: raw.businessHours?.trim(),
      delivery_option: raw.deliveryOption?.trim(),
      service_details: raw.serviceDetails?.trim(),
      additional_desc: raw.additionalDesc?.trim(),
      homepage: raw.homepage?.trim(),
      instagram: raw.instagram?.trim(),
      facebook: raw.facebook?.trim(),
      facilities: raw.facilities?.trim(),
      pets_allowed: raw.petsAllowed !== undefined ? mapBool(raw.petsAllowed) : undefined,
      parking: raw.parking?.trim(),
    };

    await client.query("BEGIN");

    // 부분 업데이트
    const set = [];
    const params = [];
    Object.entries(candidate).forEach(([col, val]) => {
      if (val !== undefined) {
        set.push(`${col} = $${set.length + 1}`);
        params.push(val === "" ? null : val);
      }
    });
    if (set.length) {
      params.push(idNum);
      await client.query(
        `UPDATE food_stores SET ${set.join(", ")} WHERE id = $${params.length}`,
        params
      );
    }

    // 새 이미지 추가(기존 유지)
    const allFiles = collectFiles(req);
    const newStoreImages = filesByField(allFiles, "storeImages", "storeImages[]");

    if (newStoreImages.length) {
      // 웹 경로 변환 (/uploads/파일명)
      const urls = newStoreImages.map(toWebPath).filter(Boolean);

      if (urls.length) {
        // 기존 이미지 모두 삭제 (중복 방지)
        await client.query(`DELETE FROM store_images WHERE store_id=$1`, [idNum]);

        // 최대 3장까지만 입력
        const limited = urls.slice(0, 3);
        const values = limited.map((_, i) => `($1,$${i + 2})`).join(",");

        await client.query(
          `INSERT INTO store_images (store_id, url) VALUES ${values}`,
          [idNum, ...limited]
        );
      }
    }

    // 메뉴 전량 교체(보낸 경우만)
    const menusA = extractMenusFromBody(raw);
    const namesB = Array.isArray(raw["menuName[]"]) ? raw["menuName[]"] : raw.menuName || [];
    const pricesB = Array.isArray(raw["menuPrice[]"]) ? raw["menuPrice[]"] : raw.menuPrice || [];
    const catsB =
      Array.isArray(raw["menuCategory[]"]) ? raw["menuCategory[]"] : raw.menuCategory || [];
    const hasLegacy = namesB.length || pricesB.length || catsB.length;

    if (menusA.length || hasLegacy) {
      await client.query(`DELETE FROM menu_items WHERE store_id=$1`, [idNum]);

      const menusB = [];
      for (let i = 0; i < Math.max(namesB.length, pricesB.length, catsB.length); i++) {
        const name = (namesB[i] || "").trim();
        const price = toInt(pricesB[i]);
        const cat = (catsB[i] || "").trim() || null;
        if (name && price > 0) {
          menusB.push({ name, price, category: cat, image_url: null, description: null });
        }
      }

      const combined = [...menusA, ...menusB];
      if (combined.length) {
        const vals = combined
          .map(
            (_, i) =>
              `($1,$${i * 5 + 2},$${i * 5 + 3},$${i * 5 + 4},$${i * 5 + 5},$${i * 5 + 6})`
          )
          .join(",");
        const p = [idNum];
        combined.forEach((m) =>
          p.push(m.name, m.price, m.category ?? null, m.image_url ?? null, m.description ?? null)
        );
        await client.query(
          `INSERT INTO menu_items (store_id, name, price, category, image_url, description) VALUES ${vals}`,
          p
        );
      }
    }

    await client.query("COMMIT");
    return res.json({ ok: true, id: idNum });
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch { }
    console.error("[updateFoodStore] error:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  } finally {
    try {
      client.release();
    } catch { }
  }
}

/* ── 호환용 export ───────────────────── */
export const getFoodStoreFull = getFoodRegisterFull; // 과거 이름 호환
export const createFoodRegister = createFoodStore;   // 과거 이름 호환
export const getFoodRegisterDetail = getFoodStoreById;
