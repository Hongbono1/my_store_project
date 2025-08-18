// controllers/foodregisterController.js
import pool from "../db.js";
import path from "path";

// 공통: 숫자 ID 가드
function parseId(raw) {
  const n = Number.parseInt(String(raw), 10);
  return Number.isSafeInteger(n) ? n : null;
}

// 업로드 파일 수집 도우미 (multer.any() / fields() 모두 대응)
function collectFiles(req) {
  if (!req || !req.files) return [];
  if (Array.isArray(req.files)) return req.files; // any()
  // fields(): { field: [files] } -> flat array
  return Object.values(req.files).flat();
}
// 특정 필드만 추출
function filesByField(files, ...fieldnames) {
  const set = new Set(fieldnames);
  return files.filter(f => set.has(f.fieldname));
}
// 웹 경로 변환
function toWebPath(f) {
  return f?.path
    ? `/uploads/${path.basename(f.path)}`
    : f?.filename
      ? `/uploads/${f.filename}`
      : null;
}

// 숫자 추출 "12,000원" → 12000
function toInt(v) {
  if (v == null) return 0;
  const n = String(v).replace(/[^\d]/g, "");
  return n ? parseInt(n, 10) : 0;
}

/* ===== 메뉴 파싱 유틸 추가: 중첩 + 브래킷 + 구형 배열 ===== */
// (A) 중첩 객체 형태(req.body.storeMenus) + (B) 브래킷 키 형태 모두 지원
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
  // (A) 중첩 객체/배열
  const sm = body?.storeMenus;
  if (sm && typeof sm === "object") {
    const groups = Array.isArray(sm) ? sm : Object.values(sm);
    groups.forEach((g) => {
      const items = Array.isArray(g) ? g : Object.values(g || {});
      items.forEach(pushItem);
    });
  }
  // (B) 브래킷 키
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

/**
 * 등록: FormData (multipart/form-data)
 * 필수: businessName, roadAddress
 * 선택: phone, storeImages[*], businessCertImage,
 *       ├ storeMenus[i][j][{category|name|price|description|image_url}] (신규)
 *       └ menuName[] / menuPrice[] / menuCategory[] / menuImage[]       (구형)
 * 응답: { ok:true, id }
 */
export async function createFoodStore(req, res) {
  const client = await pool.connect();
  try {
    const ct = req.headers["content-type"] || "";
    console.log("[createFoodStore] ct:", ct);
    console.log("[createFoodStore] body keys:", Object.keys(req.body || {}));

    // === 필수 필드 ===
    const businessName = (req.body.businessName || "").trim();
    const roadAddress = (req.body.roadAddress || "").trim();
    const phone = (req.body.phone || "").trim();

    // ⚠️ 200으로 내려 프론트 catch 방지 + 어떤 필드가 비었는지 바로 확인
    if (!businessName || !roadAddress) {
      return res.status(200).json({
        ok: false,
        error: "missing_required",
        fields: { businessName: !!businessName, roadAddress: !!roadAddress }
      });
    }

    // === 확장 필드 ===
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
      req.body.petsAllowed === "true" ? true :
        req.body.petsAllowed === "false" ? false : null;
    const parking = (req.body.parking || "").trim();

    await client.query("BEGIN");

    // 1) 가게 저장
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

    // 2) 파일 수집/분류
    const allFiles = collectFiles(req);
    const storeImageFiles = filesByField(allFiles, "storeImages", "storeImages[]");
    const certFile = filesByField(allFiles, "businessCertImage")[0];
    // 구형 메뉴 이미지 파일 배열 (인덱스 매칭)
    const menuImgFiles = filesByField(allFiles, "menuImage[]", "menuImage");

    // 2-1) 대표 이미지 저장 (store_images)
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

    // 2-2) 사업자등록증 경로 저장 (스키마에 있을 때만)
    // if (certFile) {
    //   const certPath = toWebPath(certFile);
    //   await client.query(`UPDATE food_stores SET business_cert=$2 WHERE id=$1`, [storeId, certPath]);
    // }

    // 3) 메뉴 저장 — (A) 신규/브래킷 + (B) 구형 배열 → 병합
    const menusA = extractMenusFromBody(req.body);
    const menusB = extractLegacyMenusFromBody(req.body, menuImgFiles);
    const menus = [...menusA, ...menusB];
    if (menus.length) {
      const vals = menus.map((_, i) =>
        `($1,$${i * 5 + 2},$${i * 5 + 3},$${i * 5 + 4},$${i * 5 + 5},$${i * 5 + 6})`
      ).join(",");
      const p = [storeId];
      menus.forEach(m => p.push(
        m.name,
        m.price,
        m.category ?? null,
        m.image_url ?? null,
        m.description || null
      ));
      await client.query(
        `INSERT INTO menu_items (store_id, name, price, category, image_url, description) VALUES ${vals}`,
        p
      );
    }

    // 4) 이벤트 저장
    const events = Object.entries(req.body)
      .filter(([k]) => /^event\d+$/.test(k))
      .map(([, v]) => String(v || "").trim())
      .filter(Boolean);
    if (events.length) {
      const values = events.map((_, i) => `($1,$${i + 2},${i})`).join(",");
      await client.query(
        `INSERT INTO store_events (store_id, content, ord) VALUES ${values}`,
        [storeId, ...events]
      );
    }

    await client.query("COMMIT");

    // id 정수화
    const toSafeInt = (v) => (Number.isSafeInteger(v) ? v : Number.parseInt(v, 10));
    return res.status(200).json({ ok: true, id: toSafeInt(storeId) || Date.now() });
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch { }
    console.error("[createFoodStore] error:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  } finally {
    try { client.release(); } catch { }
  }
}


/**
 * 기본 조회: /foodregister/:id
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

/**
 * 풀 상세: /foodregister/:id/full
 * - ndetail.html에서 기대하는 구조(store, images[], menus[], events[])
 */
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

    // 2) 이미지: 두 테이블 합치기 (객체 배열 유지: [{url}...])
    const { rows: images } = await pool.query(
      `
      SELECT url
        FROM store_images
       WHERE store_id = $1
      UNION ALL
      SELECT image_url AS url
        FROM food_store_images
       WHERE store_id = $1
      ORDER BY url
      `,
      [idNum]
    );

    // 3) 메뉴: 뷰 있으면 우선, 없으면 3테이블 UNION
    let menus = [];
    try {
      const view = await pool.query(
        `SELECT store_id, COALESCE(category,'기타') AS category, name, price, image_url, description
           FROM v_store_menus
          WHERE store_id = $1
          ORDER BY category, name, price`,
        [idNum]
      );
      menus = view.rows;
    } catch {
      const uni = await pool.query(
        `
        SELECT store_id, COALESCE(category,'기타') AS category, name, price, image_url, description
          FROM menu_items
         WHERE store_id = $1
        UNION ALL
        SELECT store_id, COALESCE(category,'기타') AS category, name, price, NULL::text AS image_url, description
          FROM store_menus
         WHERE store_id = $1
        UNION ALL
        SELECT store_id, COALESCE(category,'기타') AS category, name, price, image_url, description
          FROM food_menu_items
         WHERE store_id = $1
        ORDER BY category, name, price
        `,
        [idNum]
      );
      menus = uni.rows;
    }

    // 4) 이벤트
    const { rows: ev } = await pool.query(
      `SELECT content FROM store_events WHERE store_id = $1 ORDER BY ord, id`,
      [idNum]
    );

    return res.json({
      ok: true,
      store: s[0],
      images,                    // [{url: "..."}...]
      menus,                     // [{category,name,price,image_url,description}...]
      events: ev.map(x => x.content)
    });
  } catch (err) {
    console.error("[getFoodRegisterFull] error:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
}

/**
 * 수정: PUT /foodregister/:id
 * - 보낸 필드만 업데이트(빈 문자열은 NULL)
 * - event1..n 오면 이벤트 전량 교체
 * - storeImages 오면 이미지 추가
 * - storeMenus[*] 또는 (구형)menuName[] 등 오면 메뉴 전량 교체
 */
export async function updateFoodStore(req, res) {
  const client = await pool.connect();
  try {
    const idNum = parseId(req.params.id);
    if (!idNum) return res.status(400).json({ ok: false, error: "Invalid id" });

    const raw = req.body;
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

    // 이벤트 전량 교체(보낸 경우)
    const events = Object.entries(raw)
      .filter(([k]) => /^event\d+$/i.test(k))
      .map(([, v]) => String(v || "").trim())
      .filter(Boolean);
    if (events.length) {
      await client.query(`DELETE FROM store_events WHERE store_id=$1`, [idNum]);
      const values = events.map((_, i) => `($1,$${i + 2},${i})`).join(",");
      await client.query(
        `INSERT INTO store_events (store_id, content, ord) VALUES ${values}`,
        [idNum, ...events]
      );
    }

    // 새 이미지 추가(기존 유지)
    const allFiles = collectFiles(req);
    const newStoreImages = filesByField(allFiles, "storeImages", "storeImages[]");
    if (newStoreImages.length) {
      const urls = newStoreImages.map(toWebPath).filter(Boolean);
      if (urls.length) {
        const values = urls.map((_, i) => `($1,$${i + 2})`).join(",");
        await client.query(
          `INSERT INTO store_images (store_id, url) VALUES ${values}`,
          [idNum, ...urls]
        );
      }
    }

    // 메뉴 전량 교체(보낸 경우만)
    {
      const menusA = extractMenusFromBody(raw);

      const namesB = Array.isArray(raw["menuName[]"]) ? raw["menuName[]"] : (raw.menuName || []);
      const pricesB = Array.isArray(raw["menuPrice[]"]) ? raw["menuPrice[]"] : (raw.menuPrice || []);
      const catsB = Array.isArray(raw["menuCategory[]"]) ? raw["menuCategory[]"] : (raw.menuCategory || []);
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
            .map((_, i) => `($1,$${i * 5 + 2},$${i * 5 + 3},$${i * 5 + 4},$${i * 5 + 5},$${i * 5 + 6})`)
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
    }

    await client.query("COMMIT");
    return res.json({ ok: true, id: idNum });
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch { }
    console.error("[updateFoodStore] error:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  } finally {
    try { client.release(); } catch { }
  }
}


/* ── 호환용 export (기존 명칭과 동시 지원) ───────────────────── */
export const getFoodStoreFull = getFoodRegisterFull;   // 과거 이름 호환
export const createFoodRegister = createFoodStore;     // 과거 이름 호환
