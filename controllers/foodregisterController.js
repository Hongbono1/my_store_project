// controllers/foodregisterController.js
import pool from "../db.js";
import path from "path";

/* ===================== 공통 유틸 ===================== */
function parseId(raw) {
  const n = Number.parseInt(String(raw), 10);
  return Number.isSafeInteger(n) ? n : null;
}

function collectFiles(req) {
  if (!req || !req.files) return [];
  if (Array.isArray(req.files)) return req.files; // upload.any()
  return Object.values(req.files).flat(); // upload.fields()
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

// ✅ 사업자번호 digits 추출 (프론트에서 어떤 키로 보내도 잡히게)
function pickBusinessNumber(body) {
  const raw =
    body?.bizNumber ??
    body?.bizNo ??
    body?.businessNumber ??
    body?.business_number ??
    "";
  const digits = String(raw).replace(/[^\d]/g, "");
  return digits ? digits : null;
}

// ✅ (핵심) 한식 소분류(detail_category) 키가 뭐로 오든 잡기
function pickDetailCategory(body) {
  const raw =
    body?.detailCategory ??
    body?.detail_category ??
    body?.subCategory ??
    body?.sub_category ??
    body?.foodSub ??
    body?.food_sub ??
    body?.sub ??
    "";
  const v = String(raw ?? "").trim();
  return v ? v : null;
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
      theme: (m.theme ?? "").trim() || null,
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
    const m = k.match(/^storeMenus\[(\d+)\]\[(\d+)\]\[(category|name|price|description|image_url|theme)\]$/);
    if (!m) continue;
    const idx = `${m[1]}:${m[2]}`;
    (buckets[idx] ||= { category: null, name: "", price: 0, description: "", image_url: null, theme: null });
    const val = String(v ?? "").trim();
    if (m[3] === "price") buckets[idx].price = toInt(val);
    else if (m[3] === "category") buckets[idx].category = val || null;
    else buckets[idx][m[3]] = val || null;
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
  const themes = toArr(body["menuTheme[]"] ?? body.menuTheme);

  const rows = [];
  for (let i = 0; i < names.length; i++) {
    const name = (names[i] || "").trim();
    const price = toInt(prices[i]);
    const category = (cats[i] || "").trim() || null;
    const description = (descs[i] || "").trim() || null;

    const img = menuFiles[i] ? toWebPath(menuFiles[i]) : null;
    const theme = (themes[i] || "").trim() || null;

    if (name && price > 0) {
      rows.push({ name, price, category, description, image_url: img, theme });
    }
  }
  return rows;
}

/* ===================== 등록(POST) ===================== */
export async function createFoodStore(req, res) {
  console.log("BODY >>>", req.body);
  console.log("FILES >>>", req.files);

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

    // ✅ (핵심) detail_category 저장
    const detailCategory = pickDetailCategory(req.body);

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

    const businessNumber = pickBusinessNumber(req.body);
    const bizVerified = String(req.body.bizVerified || "").trim();
    console.log("[createFoodStore] bizVerified:", bizVerified, "businessNumber:", businessNumber, "detailCategory:", detailCategory);

    await client.query("BEGIN");

    // ✅ store_info에 detail_category 저장하도록 컬럼 추가
    const insertStoreQ = `
      INSERT INTO store_info (
        business_name, owner_name, phone, email, address,
        business_type, business_category, detail_category,
        business_hours, delivery_option,
        service_details, additional_desc,
        homepage, instagram, facebook,
        facilities, pets_allowed, parking,
        business_number
      ) VALUES (
        $1,$2,$3,$4,$5,
        $6,$7,$8,
        $9,$10,
        $11,$12,
        $13,$14,$15,
        $16,$17,$18,
        $19
      )
      RETURNING id
    `;

    const { rows } = await client.query(insertStoreQ, [
      businessName,
      (req.body.ownerName || null),
      (phone || null),
      (req.body.ownerEmail || req.body.email || null),
      roadAddress,
      (businessType || null),
      (businessCategory || null),
      (detailCategory || null),
      (businessHours || null),
      (deliveryOption || null),
      (serviceDetails || null),
      (additionalDesc || null),
      (homepage || null),
      (instagram || null),
      (facebook || null),
      (facilities || null),
      (petsAllowed),
      (parking || null),
      (businessNumber || null),
    ]);

    const storeId = rows[0].id;

    // 2) 파일 분류
    const allFiles = collectFiles(req);
    const storeImageFiles = filesByField(allFiles, "storeImages", "storeImages[]");
    const menuImgFiles = filesByField(allFiles, "menuImage[]", "menuImage");

    // 대표/추가 이미지
    if (storeImageFiles.length) {
      const urls = storeImageFiles.map(toWebPath).filter(Boolean);
      if (urls.length) {
        const values = urls.map((_, i) => `($1,$${i + 2},${i})`).join(",");
        await client.query(
          `INSERT INTO store_images (store_id, url, sort_order) VALUES ${values}`,
          [storeId, ...urls]
        );
      }
    }

    // 3) 메뉴 저장
    const menusA = extractMenusFromBody(req.body);
    const menusB = extractLegacyMenusFromBody(req.body, menuImgFiles);
    const menus = [...menusA, ...menusB];

    await client.query(`DELETE FROM store_menu WHERE store_id = $1`, [storeId]);

    if (menus.length) {
      const values = menus
        .map((_, i) => `($1,$${i * 6 + 2},$${i * 6 + 3},$${i * 6 + 4},$${i * 6 + 5},$${i * 6 + 6},$${i * 6 + 7})`)
        .join(",");

      const params = menus.flatMap(m => [
        m.name,
        m.price,
        (m.category || null),
        (m.image_url || null),
        (m.description || null),
        (m.theme || null),
      ]);

      await client.query(
        `INSERT INTO store_menu (store_id, name, price, category, image_url, description, theme)
         VALUES ${values}`,
        [storeId, ...params]
      );
    }

    // 4) 이벤트 저장
    const events = Object.entries(req.body)
      .filter(([k]) => /^event\d+$/i.test(k))
      .map(([, v]) => String(v || "").trim())
      .filter(Boolean);

    if (events.length) {
      // 기존 삭제(안전)
      await client.query(`DELETE FROM store_events WHERE store_id=$1`, [storeId]);

      const values = events.map((_, i) => `($1,$${i + 2},${i})`).join(",");
      await client.query(
        `INSERT INTO store_events (store_id, content, ord) VALUES ${values}`,
        [storeId, ...events]
      );
    }

    await client.query("COMMIT");

    return res.status(200).json({
      ok: true,
      id: Number(storeId),
      business_number: businessNumber || null,
      detail_category: detailCategory || null,
    });
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch { }
    console.error("[createFoodStore] error:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  } finally {
    try { client.release(); } catch { }
  }
}

/* ===================== 단건 조회(GET /:id) ===================== */
export async function getFoodStoreById(req, res) {
  try {
    const storeId = parseId(req.params.id);
    if (!storeId) return res.status(400).json({ ok: false, error: "Invalid id" });

    const q = `
      SELECT
        id,
        business_name AS "businessName",
        address AS "roadAddress",
        phone,
        created_at AS "createdAt",
        business_category AS "businessCategory",
        detail_category AS "detailCategory"
      FROM store_info
      WHERE id = $1
    `;
    const { rows } = await pool.query(q, [storeId]);
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
    const storeId = parseId(req.params.id);
    if (!storeId) return res.status(400).json({ ok: false, error: "Invalid id" });

    const { rows: s } = await pool.query(
      `SELECT
         id,
         business_name,
         address,
         phone,
         created_at,
         business_type, business_category, detail_category,
         business_hours, delivery_option,
         service_details, additional_desc,
         homepage, instagram, facebook,
         facilities, pets_allowed, parking,
         business_number
       FROM store_info
       WHERE id = $1`,
      [storeId]
    );
    if (!s.length) return res.status(404).json({ ok: false, error: "not_found" });

    const { rows: images } = await pool.query(
      `SELECT url
         FROM store_images
        WHERE store_id = $1
        ORDER BY sort_order, id`,
      [storeId]
    );

    const { rows: menus } = await pool.query(
      `SELECT store_id, COALESCE(category,'기타') AS category,
              name, price, image_url, description, theme
         FROM store_menu
        WHERE store_id = $1
        ORDER BY id ASC`,
      [storeId]
    );

    const { rows: ev } = await pool.query(
      `SELECT content FROM store_events WHERE store_id = $1 ORDER BY ord, id`,
      [storeId]
    );

    return res.json({
      ok: true,
      store: s[0],
      images,
      menus,
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
    const storeId = parseId(req.params.id);
    if (!storeId) return res.status(400).json({ ok: false, error: "Invalid id" });

    const raw = req.body || {};
    const mapBool = (v) =>
      v === true || v === "true" ? true : v === false || v === "false" ? false : null;

    const candidate = {
      business_name: raw.businessName?.trim(),
      address: (raw.roadAddress ?? raw.address)?.trim(),
      phone: raw.phone?.trim(),
      business_type: raw.businessType?.trim(),
      business_category: raw.businessCategory?.trim(),
      detail_category: (raw.detailCategory ?? raw.detail_category ?? raw.sub)?.trim(),
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

    const set = [];
    const params = [];
    Object.entries(candidate).forEach(([col, val]) => {
      if (val !== undefined) {
        set.push(`${col} = $${set.length + 1}`);
        params.push(val === "" ? null : val);
      }
    });

    if (set.length) {
      params.push(storeId);
      await client.query(
        `UPDATE store_info SET ${set.join(", ")} WHERE id = $${params.length}`,
        params
      );
    }

    // 메뉴 갱신(사용 시)
    const allFiles = collectFiles(req);
    const menuImgFiles = filesByField(allFiles, "menuImage[]", "menuImage");

    const menusA = extractMenusFromBody(req.body);
    const menusB = extractLegacyMenusFromBody(req.body, menuImgFiles);
    const menus = [...menusA, ...menusB].filter(m => m.name && m.price > 0);

    await client.query(`DELETE FROM store_menu WHERE store_id=$1`, [storeId]);
    if (menus.length) {
      const values = menus
        .map((_, i) => `($1,$${i * 6 + 2},$${i * 6 + 3},$${i * 6 + 4},$${i * 6 + 5},$${i * 6 + 6},$${i * 6 + 7})`)
        .join(",");

      const params2 = menus.flatMap(m => [
        m.name, m.price, m.category || null, m.image_url || null, m.description || null, m.theme || null,
      ]);

      await client.query(
        `INSERT INTO store_menu (store_id, name, price, category, image_url, description, theme)
         VALUES ${values}`,
        [storeId, ...params2]
      );
    }

    // 이벤트 갱신(사용 시)
    const events = Object.entries(raw)
      .filter(([k]) => /^event\d+$/i.test(k))
      .map(([, v]) => String(v || "").trim())
      .filter(Boolean);

    await client.query(`DELETE FROM store_events WHERE store_id=$1`, [storeId]);
    if (events.length) {
      const values = events.map((_, i) => `($1,$${i + 2},${i})`).join(",");
      await client.query(
        `INSERT INTO store_events (store_id, content, ord) VALUES ${values}`,
        [storeId, ...events]
      );
    }

    await client.query("COMMIT");
    return res.json({ ok: true, id: storeId });
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch { }
    console.error("[updateFoodStore] error:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  } finally {
    try { client.release(); } catch { }
  }
}

/* ── 호환용 export ───────────────────── */
export const getFoodStoreFull = getFoodRegisterFull;
export const createFoodRegister = createFoodStore;
export const getFoodRegisterDetail = getFoodStoreById;
