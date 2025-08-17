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

/**
 * 등록: FormData (multipart/form-data)
 * 필수: businessName, roadAddress
 * 선택: phone, storeImages[*], businessCertImage, storeMenus[i][j][{category|name|price}]
 * 응답: { ok:true, id }
 */
export async function createFoodStore(req, res) {
  const client = await pool.connect();
  try {
    console.log("[createFoodStore] ct:", req.headers["content-type"]);
    console.log("[createFoodStore] body keys:", Object.keys(req.body || {}));
    if (Array.isArray(req.files)) {
      console.log("[createFoodStore] files:", req.files.map(f => `${f.fieldname}:${f.originalname}`));
    } else if (req.files && typeof req.files === "object") {
      console.log("[createFoodStore] files(fields):", Object.entries(req.files).flatMap(([k, arr]) => arr.map(f => `${k}:${f.originalname}`)));
    }

    const businessName = (req.body.businessName || "").trim();
    const roadAddress = (req.body.roadAddress || "").trim();
    const phone = (req.body.phone || "").trim();

    // ⚠️ 일단 200으로 내려 프론트 catch 방지 + 어떤 필드가 비었는지 바로 확인
    if (!businessName || !roadAddress) {
      return res.status(200).json({
        ok: false,
        error: "missing_required",
        fields: { businessName: !!businessName, roadAddress: !!roadAddress }
      });
    }

    // 확장 필드들
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

    // 2) 업로드 파일 분류
    const allFiles = collectFiles(req);
    const storeImageFiles = filesByField(allFiles, "storeImages", "storeImages[]");
    const certFile = filesByField(allFiles, "businessCertImage")[0];

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

    // 2-2) 사업자등록증 경로 저장 옵션 (스키마에 컬럼이 있을 때만 사용)
    // 만약 food_stores 테이블에 business_cert 컬럼이 있다면 주석 해제:
    // if (certFile) {
    //   const certPath = toWebPath(certFile);
    //   await client.query(`UPDATE food_stores SET business_cert=$2 WHERE id=$1`, [storeId, certPath]);
    // }

    // 3) 메뉴 저장
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
      const vals = menus.map((_, i) => `($1,$${i * 3 + 2},$${i * 3 + 3},$${i * 3 + 4})`).join(",");
      const params = [storeId];
      menus.forEach(m => { params.push(m.name, m.price, m.category); });
      await client.query(
        `INSERT INTO menu_items (store_id, name, price, category) VALUES ${vals}`,
        params
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
    return res.json({ ok: true, id: storeId });
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch { }
    console.error("[createFoodStore] error:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  } finally {
    // 꼭 client로 release/rollback 하세요 (pool 아님)
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

    // created_at이 스키마에 없을 수 있어 안전하게 NULL로 대체
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

    // 1) 가게 (created_at 미보유 대비)
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

/**
 * 수정: PUT /foodregister/:id
 * - 보낸 필드만 업데이트(빈 문자열은 NULL)
 * - event1..n 오면 이벤트 전량 교체
 * - storeImages 오면 이미지 추가
 * - storeMenus[*] 오면 메뉴 전량 교체
 */
export async function updateFoodStore(req, res) {
  const client = await pool.connect();
  try {
    const idNum = parseId(req.params.id);
    if (!idNum) return res.status(400).json({ ok: false, error: "Invalid id" });

    const raw = req.body;
    const mapBool = v =>
      v === true || v === "true" ? true
        : v === false || v === "false" ? false
          : null;

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
      .filter(([k]) => /^event\d+$/.test(k))
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

    // 새 이미지 추가(기존 유지) — storeImages 계열만
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

    // 메뉴 전량 교체(보낸 경우에만)
    const menuBuckets = {};
    let hasMenu = false;
    for (const [k, v] of Object.entries(raw)) {
      const m = k.match(/^storeMenus\[(\d+)\]\[(\d+)\]\[(category|name|price)\]$/);
      if (!m) continue;
      hasMenu = true;
      const [, ci, mi, key] = m;
      const idx = `${ci}:${mi}`;
      menuBuckets[idx] ??= { category: null, name: "", price: 0 };
      if (key === "price") menuBuckets[idx].price = parseInt(String(v).replace(/[^\d]/g, ""), 10) || 0;
      if (key === "name") menuBuckets[idx].name = String(v).trim();
      if (key === "category") menuBuckets[idx].category = String(v).trim() || null;
    }
    if (hasMenu) {
      await client.query(`DELETE FROM menu_items WHERE store_id=$1`, [idNum]);
      const menus = Object.values(menuBuckets).filter(m => m.name && m.price > 0);
      if (menus.length) {
        const vals = menus.map((_, i) => `($1,$${i * 3 + 2},$${i * 3 + 3},$${i * 3 + 4})`).join(",");
        const p = [idNum];
        menus.forEach(m => { p.push(m.name, m.price, m.category); });
        await client.query(
          `INSERT INTO menu_items (store_id, name, price, category) VALUES ${vals}`,
          p
        );
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
