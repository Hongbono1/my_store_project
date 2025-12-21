// controllers/ncombinedregisterController.js
import pool from "../db.js";
import path from "path";

/** 문자열 보정 */
const s = (v) => (v == null ? "" : String(v).trim());

/** 숫자 보정 (가격용) */
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
const arr = (v) => (Array.isArray(v) ? v : v != null ? [v] : []);

/** ✅ 사업자번호 digits-only 뽑기 */
function pickBusinessNumber(body) {
  const candidates = [
    body?.businessNumber,
    body?.business_number,
    body?.bizNumber,
    body?.bizNo,
    body?.biz_number,
    body?.businessNo,
    body?.business_no,
    body?.bno,
    body?.b_no,
  ];

  for (const raw of candidates) {
    const digits = String(raw ?? "").replace(/[^\d]/g, "");
    if (digits) return digits;
  }

  // 키가 애매하게 오는 경우도 방어
  for (const [k, v] of Object.entries(body || {})) {
    const key = String(k || "").toLowerCase();
    if (!/(biz|business)/.test(key)) continue;
    if (!/(no|number)/.test(key)) continue;
    const digits = String(v ?? "").replace(/[^\d]/g, "");
    if (digits) return digits;
  }

  return null;
}

/** ✅ 사업자번호 길이: 10~11 허용 */
function isBizLenOk(digits) {
  const len = String(digits || "").length;
  return len >= 10 && len <= 11;
}

/* ----------------------
 * 저장 (등록 처리)
 * ---------------------- */
export async function createCombinedStore(req, res) {
  const client = await pool.connect();
  try {
    const raw = req.body || {};
    const allFiles = Array.isArray(req.files)
      ? req.files
      : Object.values(req.files || {}).flat();

    const businessNumberDigits = pickBusinessNumber(raw); // ✅ digits-only
    console.log("==== [createCombinedStore] incoming ====");
    console.log("businessNumberDigits:", businessNumberDigits);
    console.log("menuName[]:", raw["menuName[]"]);
    console.log("menuPrice[]:", raw["menuPrice[]"]);
    console.log("menuCategory[]:", raw["menuCategory[]"]);

    // ✅ 사업자번호 없거나 길이 이상하면 등록 막기 (빈값 저장 방지)
    if (!businessNumberDigits) {
      return res.status(200).json({ ok: false, error: "business_number_required" });
    }
    if (!isBizLenOk(businessNumberDigits)) {
      return res.status(200).json({
        ok: false,
        error: "invalid_business_number",
        message: "business_number must be 10~11 digits",
      });
    }

    await client.query("BEGIN");

    // ✅ 같은 사업자번호 중복 등록 차단 (combined_store_info 기준)
    const dup = await client.query(
      `SELECT id FROM public.combined_store_info WHERE business_number = $1 LIMIT 1`,
      [businessNumberDigits]
    );

    if (dup.rows.length) {
      await client.query("ROLLBACK");
      return res.status(200).json({
        ok: false,
        error: "duplicate_business_number",
        message: "이미 등록된 사업자번호입니다.",
        existingId: dup.rows[0].id,
      });
    }

    // ✅ combined_store_info 저장
    const storeSql = `
      INSERT INTO combined_store_info (
        business_number, business_name, business_type,
        business_category, business_subcategory,
        business_hours, delivery_option, service_details,
        event1, event2, facilities, pets_allowed, parking,
        phone, homepage, instagram, facebook,
        additional_desc, postal_code, road_address, detail_address,
        owner_name, birth_date, owner_email, owner_address, owner_phone,
        business_cert_path, created_at
      ) VALUES (
        $1,$2,$3,
        $4,$5,
        $6,$7,$8,
        $9,$10,$11,$12,$13,
        $14,$15,$16,$17,
        $18,$19,$20,$21,
        $22,$23,$24,$25,$26,
        $27,NOW()
      )
      RETURNING id
    `;

    const certFile = allFiles.find((f) => f.fieldname === "businessCertImage");
    const certPath = certFile ? toWeb(certFile) : null;

    const storeVals = [
      businessNumberDigits,                 // $1 ✅ digits-only 강제 저장 (필수)
      s(raw.businessName),                  // $2
      s(raw.businessType),                  // $3
      s(raw.mainCategory ?? raw.businessCategory ?? raw.business_category),  // $4
      s(raw.subCategory ?? raw.detailCategory ?? raw.businessSubcategory ?? raw.business_subcategory), // $5
      s(raw.businessHours),                 // $6
      s(raw.deliveryOption),                // $7
      s(raw.serviceDetails),                // $8
      s(raw.event1),                        // $9
      s(raw.event2),                        // $10
      s(raw.facilities),                    // $11
      b(raw.petsAllowed),                   // $12
      s(raw.parking),                       // $13
      s(raw.phone ?? raw.phoneNumber),      // $14
      s(raw.homepage),                      // $15
      s(raw.instagram),                     // $16
      s(raw.facebook),                      // $17
      s(raw.additionalDesc),                // $18
      s(raw.postalCode),                    // $19
      s(raw.roadAddress),                   // $20
      s(raw.detailAddress),                 // $21
      s(raw.ownerName),                     // $22
      raw.birthDate ? new Date(raw.birthDate) : null, // $23
      s(raw.ownerEmail),                    // $24
      [s(raw.ownerAddress), s(raw.ownerAddressDetail)].filter(Boolean).join(" "), // $25
      s(raw.ownerPhone),                    // $26
      certPath                              // $27
    ];

    const storeResult = await client.query(storeSql, storeVals);
    const storeId = storeResult.rows[0].id;

    // ✅ 대표/갤러리 이미지 저장 (storeImages / storeImages[] 둘 다)
    const storeImageFiles = allFiles.filter(
      (f) => f.fieldname === "storeImages" || f.fieldname === "storeImages[]"
    );
    for (const f of storeImageFiles) {
      const url = toWeb(f);
      if (!url) continue;
      await client.query(
        `INSERT INTO combined_store_images (store_id, url) VALUES ($1, $2)`,
        [storeId, url]
      );
    }

    // ✅ 메뉴 저장
    const names = arr(raw["menuName[]"] ?? raw.menuName);
    const prices = arr(raw["menuPrice[]"] ?? raw.menuPrice).map((p) => n(p));
    const catsByRow = Array.isArray(raw["menuCategory[]"]) ? raw["menuCategory[]"] : null;

    const menuImageFiles = allFiles.filter(
      (f) => f.fieldname === "menuImage[]" || f.fieldname === "menuImage"
    );
    const menuImgUrls = menuImageFiles.map((f) => toWeb(f)) ?? [];

    const menus = [];

    if (catsByRow) {
      // 행별 1:1 매칭
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
      // 구방식 fallback: categoryName[] + menuCount_x
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

    for (const m of menus) {
      await client.query(
        `
          INSERT INTO combined_menu_items (store_id, category, name, price, image_url, description)
          VALUES ($1,$2,$3,$4,$5,$6)
          ON CONFLICT (store_id, category, name)
          DO UPDATE SET
            price = EXCLUDED.price,
            image_url = COALESCE(EXCLUDED.image_url, combined_menu_items.image_url),
            description = COALESCE(EXCLUDED.description, combined_menu_items.description)
        `,
        [storeId, m.category, m.name, m.price, m.image_url, m.description]
      );
    }

    // ✅ 이벤트 저장 (events[]/events 형태 모두)
    const eventsArr = arr(raw["events[]"] ?? raw.events);
    for (let i = 0; i < eventsArr.length; i++) {
      const content = s(eventsArr[i]);
      if (!content) continue;
      await client.query(
        `INSERT INTO combined_store_events (store_id, content, ord) VALUES ($1, $2, $3)`,
        [storeId, content, i + 1]
      );
    }

    await client.query("COMMIT");
    console.log("[createCombinedStore] 성공:", storeId, "biz:", businessNumberDigits);

    return res.json({ ok: true, id: storeId, businessNumber: businessNumberDigits });
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch { }
    console.error("[createCombinedStore] error:", err);
    return res
      .status(500)
      .json({ ok: false, error: "DB insert failed", message: err.message });
  } finally {
    client.release();
  }
}

/* ----------------------
 * 사업자번호로 조회
 * ---------------------- */
export async function getCombinedStoreByBusinessNumber(req, res) {
  try {
    const businessNumber = String(req.params.businessNumber ?? "").replace(/[^\d]/g, "");
    if (!businessNumber) {
      return res.status(400).json({ ok: false, error: "business_number_required" });
    }
    if (!isBizLenOk(businessNumber)) {
      return res.status(400).json({ ok: false, error: "invalid_business_number" });
    }

    const { rows: storeRows } = await pool.query({
      text: `
        SELECT *,
               (COALESCE(road_address,'') || ' ' || COALESCE(detail_address,'')) AS address
        FROM combined_store_info
        WHERE regexp_replace(COALESCE(business_number::text,''), '[^0-9]', '', 'g') = $1
        ORDER BY created_at DESC
        LIMIT 1
      `,
      values: [businessNumber],
    });

    if (!storeRows.length) {
      return res.status(404).json({ ok: false, error: "not_found" });
    }

    const base = storeRows[0];
    const storeId = base.id;

    const store = {
      id: base.id,
      business_name: base.business_name ?? "-",
      business_type: base.business_type ?? "-",
      business_category: base.business_category ?? "-",
      delivery_option: base.delivery_option ?? "-",
      business_hours: base.business_hours ?? "-",
      service_details: base.service_details ?? "-",
      additional_desc: base.additional_desc ?? "-",
      phone: base.phone ?? "",
      homepage: base.homepage ?? "",
      instagram: base.instagram ?? "",
      facebook: base.facebook ?? "",
      facilities: base.facilities ?? "-",
      pets_allowed: base.pets_allowed ?? null,
      parking: base.parking ?? "-",
      address: base.address ?? "-",
    };

    const { rows: imageRows } = await pool.query({
      text: `
        SELECT url
        FROM combined_store_images
        WHERE store_id=$1
        ORDER BY sort_order, id
      `,
      values: [storeId],
    });
    const images = imageRows.map((r) => ({ url: r.url }));

    const { rows: menuRows } = await pool.query({
      text: `
        SELECT category, name, price, image_url, description
        FROM combined_menu_items
        WHERE store_id=$1
        ORDER BY category, name
      `,
      values: [storeId],
    });
    const menus = menuRows.map((r) => ({
      category: r.category ?? "기타",
      name: r.name,
      price: r.price ?? 0,
      image_url: r.image_url,
      description: r.description ?? "",
    }));

    const { rows: evRows } = await pool.query({
      text: `
        SELECT content
        FROM combined_store_events
        WHERE store_id=$1
        ORDER BY ord
      `,
      values: [storeId],
    });
    const events = evRows.map((r) => r.content).filter(Boolean);

    return res.json({ ok: true, store, images, menus, events });
  } catch (err) {
    console.error("[getCombinedStoreByBusinessNumber] error:", err);
    return res.status(500).json({
      ok: false,
      error: "DB fetch failed",
      message: err.message,
    });
  }
}

/* ----------------------
 * 조회 (상세 보기)
 * ---------------------- */
export async function getCombinedStoreFull(req, res) {
  try {
    const storeId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(storeId)) {
      return res.status(400).json({ ok: false, error: "invalid_id" });
    }

    const { rows: storeRows } = await pool.query({
      text: `
        SELECT *,
               (COALESCE(road_address,'') || ' ' || COALESCE(detail_address,'')) AS address
        FROM combined_store_info
        WHERE id=$1
      `,
      values: [storeId],
    });

    if (!storeRows.length) {
      return res.status(404).json({ ok: false, error: "not_found" });
    }

    const base = storeRows[0];
    const store = {
      id: base.id,
      business_name: base.business_name ?? "-",
      business_type: base.business_type ?? "-",
      business_category: base.business_category ?? "-",
      delivery_option: base.delivery_option ?? "-",
      business_hours: base.business_hours ?? "-",
      service_details: base.service_details ?? "-",
      additional_desc: base.additional_desc ?? "-",
      phone: base.phone ?? "",
      homepage: base.homepage ?? "",
      instagram: base.instagram ?? "",
      facebook: base.facebook ?? "",
      facilities: base.facilities ?? "-",
      pets_allowed: base.pets_allowed ?? null,
      parking: base.parking ?? "-",
      address: base.address ?? "-",
    };

    const { rows: imageRows } = await pool.query({
      text: `
        SELECT url
        FROM combined_store_images
        WHERE store_id=$1
        ORDER BY sort_order, id
      `,
      values: [storeId],
    });
    const images = imageRows.map((r) => ({ url: r.url }));

    const { rows: menuRows } = await pool.query({
      text: `
        SELECT category, name, price, image_url, description
        FROM combined_menu_items
        WHERE store_id=$1
        ORDER BY category, name
      `,
      values: [storeId],
    });
    const menus = menuRows.map((r) => ({
      category: r.category ?? "기타",
      name: r.name,
      price: r.price ?? 0,
      image_url: r.image_url,
      description: r.description ?? "",
    }));

    const { rows: evRows } = await pool.query({
      text: `
        SELECT content
        FROM combined_store_events
        WHERE store_id=$1
        ORDER BY ord
      `,
      values: [storeId],
    });
    const events = evRows.map((r) => r.content).filter(Boolean);

    return res.json({ ok: true, store, images, menus, events });
  } catch (err) {
    console.error("[getCombinedStoreFull] error:", err);
    return res.status(500).json({
      ok: false,
      error: "DB fetch failed",
      message: err.message,
    });
  }
}
