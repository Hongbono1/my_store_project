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
  const themes = toArr(body["menuTheme[]"] ?? body.menuTheme); // ✅ 추가됨


  const rows = [];
  for (let i = 0; i < names.length; i++) {
    const name = (names[i] || "").trim();
    const price = toInt(prices[i]);
    const category = (cats[i] || "").trim() || null;
    const description = (descs[i] || "").trim() || null;

    // 파일 인덱스 매칭
    const img = menuFiles[i] ? toWebPath(menuFiles[i]) : null;

    if (name && price > 0) {
      const theme = (themes[i] || "").trim() || null;
      rows.push({ name, price, category, description, image_url: img, theme }); // ✅ theme 추가
    }
  }
  return rows;
}

/* ===================== 등록(POST) ===================== */


export async function createFoodStore(req, res) {
  console.log("BODY >>>", req.body);
  console.log("FILES >>>", req.files);
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
  INSERT INTO store_info (
    business_name, owner_name, phone, email, address,
    business_type, business_category, business_hours, delivery_option,
    service_details, additional_desc,
    homepage, instagram, facebook,
    facilities, pets_allowed, parking
  ) VALUES (
    $1,$2,$3,$4,$5,
    $6,$7,$8,$9,
    $10,$11,
    $12,$13,$14,
    $15,$16,$17
  )
  RETURNING id
`;

    const { rows } = await client.query(insertStoreQ, [
      businessName,
      (req.body.ownerName || null),
      (phone || null),
      (req.body.ownerEmail || req.body.email || null),
      roadAddress,                       // ✅ address 로 매핑
      (businessType || null),
      (businessCategory || null),
      (businessHours || null),
      (deliveryOption || null),
      (serviceDetails || null),
      (additionalDesc || null),
      (homepage || null),
      (instagram || null),
      (facebook || null),
      (facilities || null),
      (petsAllowed),
      (parking || null)
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

    // 저장 전 기존 것 정리
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
        (m.theme || null)
      ]);

      await client.query(
        `INSERT INTO store_menu (store_id, name, price, category, image_url, description, theme)
     VALUES ${values}`,
        [storeId, ...params]
      );
    }


    // 4) 이벤트 저장 (inline 파싱)
    const events = Object.entries(req.body)
      .filter(([k]) => /^event\d+$/i.test(k))
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
    const storeId = parseId(req.params.id);
    if (!storeId) return res.status(400).json({ ok: false, error: "Invalid id" });
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

    // 1) 가게 (store_info 테이블 사용)
    const { rows: s } = await pool.query(
      `SELECT
         id,
         business_name,
         address,
         phone,
         created_at,
         business_type, business_category, business_hours, delivery_option,
         service_details, additional_desc,
         homepage, instagram, facebook,
         facilities, pets_allowed, parking
       FROM store_info
       WHERE id = $1`,
      [storeId]
    );
    if (!s.length) return res.status(404).json({ ok: false, error: "not_found" });

    // 2) 이미지 → store_images 사용 (기존과 동일)
    const { rows: images } = await pool.query(
      `SELECT url 
         FROM store_images
        WHERE store_id = $1
        ORDER BY sort_order, id`,
      [storeId]
    );

    // 3) 메뉴 → store_menu 테이블로 변경
    const { rows: menus } = await pool.query(
      `SELECT store_id, COALESCE(category,'기타') AS category,
              name, price, image_url, description
         FROM store_menu
        WHERE store_id = $1
        ORDER BY id ASC`,
      [storeId]
    );

    // 4) 이벤트 (기존과 동일)
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
      params.push(storeId);
      await client.query(
        `UPDATE food_stores SET ${set.join(", ")} WHERE id = $${params.length}`,
        params
      );
    }

    // 3) 메뉴 저장
    // 3) 메뉴 저장  (이 블록으로 교체)
    const allFiles = collectFiles(req);
    const menuImgFiles = filesByField(allFiles, "menuImage[]", "menuImage");

    // 신규 JSON 우선 사용
    const menusJsonRaw = req.body.menusJson || req.body.menus || req.body.menuList;
    let menusFromJson = [];
    try { menusFromJson = JSON.parse(menusJsonRaw || "[]"); } catch { menusFromJson = []; }

    // hasImage 플래그로 파일을 안전하게 매칭
    let ptr = 0;
    const menusFromJsonWithFiles = menusFromJson.map((m) => {
      const base = {
        name: (m.name || "").trim(),
        price: toInt(m.price),
        category: (m.category || "").trim() || null,
        description: (m.description || "").trim() || null,
        image_url: (m.image_url || "").trim() || null,
      };
      if (m.hasImage && menuImgFiles[ptr]) {
        base.image_url = toWebPath(menuImgFiles[ptr++]) || base.image_url;
      }
      return base;
    });

    // 구형 폼(백워드 컴패티빌리티): menuName[]/menuPrice[]/menuDesc[] + menuImage[]
    const legacyMenus = extractLegacyMenusFromBody(req.body, menuImgFiles.slice(ptr));

    // 최종 합치기
    const menus = [...menusFromJsonWithFiles, ...legacyMenus]
      .filter(m => m.name && m.price > 0);

    // 저장 전 기존 것 정리(신규 생성에도 안전)
    await client.query(`DELETE FROM menu_items WHERE store_id=$1`, [storeId]);

    if (menus.length) {
      const vals = menus
        .map((_, i) => `($1,$${i * 5 + 2},$${i * 5 + 3},$${i * 5 + 4},$${i * 5 + 5},$${i * 5 + 6})`)
        .join(",");

      const params = menus.flatMap(m => [
        m.name,
        m.price,
        m.category,
        m.image_url || null,
        m.description || null
      ]);

      await client.query(
        `INSERT INTO menu_items (store_id, name, price, category, image_url, description) VALUES ${vals}`,
        [storeId, ...params]
      );
    }

    await client.query("COMMIT");
    return res.json({ ok: true, id: storeId });
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

/* ===================== 상세 조회(GET /store/:id/full) ===================== */
export async function getStoreFull(req, res) {
  try {
    const { id } = req.params;
    console.log(`🏪 getStoreFull 호출됨 - ID: ${id}`);
    
    if (!id || isNaN(Number(id))) {
      return res.status(400).json({ ok: false, error: "유효하지 않은 ID" });
    }
    
    // 1. 가게 기본 정보 조회 (foods 테이블)
    const storeResult = await pool.query(`
      SELECT 
        id,
        store_name,
        store_category as category,
        business_hours,
        phone,
        road_address as address,
        detail_address,
        postal_code,
        service_details as description,
        image_url,
        lat,
        lng,
        delivery_option,
        parking,
        facilities,
        pets_allowed,
        homepage,
        instagram,
        facebook,
        event1,
        event2,
        additional_desc,
        created_at
      FROM foods 
      WHERE id = $1
    `, [id]);
    
    if (storeResult.rows.length === 0) {
      console.log(`⚠️ 가게 ID ${id} 없음`);
      return res.status(404).json({ ok: false, error: "가게를 찾을 수 없습니다." });
    }
    
    const store = storeResult.rows[0];
    
    // 2. 메뉴 조회 (menus 테이블)
    let menus = [];
    try {
      const menuResult = await pool.query(`
        SELECT 
          id,
          name,
          price,
          category,
          description,
          image_url,
          theme
        FROM menus 
        WHERE store_id = $1 
        ORDER BY category, id
      `, [id]);
      menus = menuResult.rows;
      console.log(`📋 메뉴 ${menus.length}개 조회됨`);
    } catch (err) {
      console.log("⚠️ menus 테이블 조회 실패:", err.message);
    }
    
    // 3. 추가 이미지 조회 (store_images 테이블)
    let images = [];
    try {
      const imageResult = await pool.query(`
        SELECT image_url 
        FROM store_images 
        WHERE store_id = $1 
        ORDER BY id
      `, [id]);
      images = imageResult.rows.map(row => row.image_url);
      console.log(`🖼️ 이미지 ${images.length}개 조회됨`);
    } catch (err) {
      console.log("⚠️ store_images 테이블 조회 실패:", err.message);
    }
    
    // 4. 응답 구성
    const response = {
      ok: true,
      data: {
        ...store,
        menus,
        images,
        menu_count: menus.length,
        image_count: images.length
      }
    };
    
    console.log(`✅ 가게 상세 조회 성공: ${store.store_name}`);
    res.json(response);
    
  } catch (err) {
    console.error("❌ getStoreFull 오류:", err);
    res.status(500).json({ ok: false, error: "서버 오류" });
  }
}

// GET /combined/:id/full - 통합 상세 정보 (getStoreFull과 동일)
export async function getCombinedFull(req, res) {
  console.log(`🔄 getCombinedFull 호출됨 - getStoreFull로 위임`);
  return getStoreFull(req, res);
}

/* ── 호환용 export ───────────────────── */
export const getFoodStoreFull = getFoodRegisterFull;
export const createFoodRegister = createFoodStore;
export const getFoodRegisterDetail = getFoodStoreById;
