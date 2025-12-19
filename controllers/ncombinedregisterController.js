// controllers/ncombinedregisterController.js
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
const toWeb = (file) =>
  file?.path ? `/uploads/${path.basename(file.path)}` : null;
/** 배열화 유틸 */
const arr = (v) => (Array.isArray(v) ? v : v != null ? [v] : []);

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

    console.log("==== [createCombinedStore] incoming body ====");
    console.log("menuName[]:", raw["menuName[]"]);
    console.log("menuPrice[]:", raw["menuPrice[]"]);
    console.log("menuCategory[]:", raw["menuCategory[]"]);

    await client.query("BEGIN");

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

    const certFile = allFiles.find(f => f.fieldname === "businessCertImage");
    const certPath = certFile ? toWeb(certFile) : null;

    const storeVals = [
      s(raw.businessNumber),                   // $1
      s(raw.businessName),                     // $2
      s(raw.businessType),                     // $3
      s(raw.mainCategory),                     // $4
      s(raw.subCategory),                      // $5
      s(raw.businessHours),                    // $6
      s(raw.deliveryOption),                   // $7
      s(raw.serviceDetails),                   // $8
      s(raw.event1),                           // $9
      s(raw.event2),                           // $10
      s(raw.facilities),                       // $11
      b(raw.petsAllowed),                      // $12
      s(raw.parking),                          // $13
      s(raw.phone ?? raw.phoneNumber),         // $14
      s(raw.homepage),                         // $15
      s(raw.instagram),                        // $16
      s(raw.facebook),                         // $17
      s(raw.additionalDesc),                   // $18
      s(raw.postalCode),                       // $19
      s(raw.roadAddress),                      // $20
      s(raw.detailAddress),                    // $21
      s(raw.ownerName),                        // $22
      raw.birthDate ? new Date(raw.birthDate) : null, // $23
      s(raw.ownerEmail),                       // $24
      [s(raw.ownerAddress), s(raw.ownerAddressDetail)].filter(Boolean).join(' '), // $25
      s(raw.ownerPhone),                       // $26
      certPath                                 // $27
    ];

    const storeResult = await client.query(storeSql, storeVals);
    const storeId = storeResult.rows[0].id;

    // ✅ 대표/갤러리 이미지 저장
    const storeImageFiles = allFiles.filter((f) => f.fieldname === "storeImages");
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
    const catsByRow = Array.isArray(raw["menuCategory[]"])
      ? raw["menuCategory[]"]
      : null;

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
    `,
        [storeId, m.category, m.name, m.price, m.image_url, m.description]
      );
    }

    // ✅ 이벤트 저장 (클라이언트에서 events[]로 전송됨)
    const eventsArr = arr(raw['events[]'] ?? raw.events);
    for (let i = 0; i < eventsArr.length; i++) {
      const content = s(eventsArr[i]);
      if (!content) continue;
      await client.query(
        `INSERT INTO combined_store_events (store_id, content, ord) VALUES ($1, $2, $3)`,
        [storeId, content, i + 1]
      );
    }

    await client.query("COMMIT");
    console.log("[createCombinedStore] 성공:", storeId);
    // ✅ 사업자번호도 반환 (리다이렉트용)
    const businessNumber = s(raw.businessNumber);
    return res.json({ ok: true, id: storeId, businessNumber });
  } catch (err) {
    await client.query("ROLLBACK");
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
    const businessNumber = s(req.params.businessNumber);
    if (!businessNumber) {
      return res.status(400).json({ ok: false, error: "business_number_required" });
    }

    /* ────────────── 1) 기본 상점 정보 ────────────── */
    const { rows: storeRows } = await pool.query({
      text: `
        SELECT *,
               (COALESCE(road_address,'') || ' ' || COALESCE(detail_address,'')) AS address
        FROM combined_store_info
        WHERE business_number=$1
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

    /* ────────────── 2) 이미지 ────────────── */
    const { rows: imageRows } = await pool.query({
      text: `
        SELECT url 
        FROM combined_store_images 
        WHERE store_id=$1 
        ORDER BY sort_order, id
      `,
      values: [storeId],
    });
    const images = imageRows.map(r => ({ url: r.url }));

    /* ────────────── 3) 메뉴 ────────────── */
    const { rows: menuRows } = await pool.query({
      text: `
        SELECT category, name, price, image_url, description
        FROM combined_menu_items
        WHERE store_id=$1
        ORDER BY category, name
      `,
      values: [storeId],
    });
    const menus = menuRows.map(r => ({
      category: r.category ?? "기타",
      name: r.name,
      price: r.price ?? 0,
      image_url: r.image_url,
      description: r.description ?? ""
    }));

    /* ────────────── 4) 이벤트 ────────────── */
    const { rows: evRows } = await pool.query({
      text: `
        SELECT content 
        FROM combined_store_events 
        WHERE store_id=$1 
        ORDER BY ord
      `,
      values: [storeId],
    });
    const events = evRows.map(r => r.content).filter(Boolean);

    /* ────────────── 최종 응답 ────────────── */
    return res.json({
      ok: true,
      store,
      images,
      menus,
      events,
    });
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

    /* ────────────── 1) 기본 상점 정보 ────────────── */
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

    /* ────────────── 2) 이미지 ────────────── */
    const { rows: imageRows } = await pool.query({
      text: `
        SELECT url 
        FROM combined_store_images 
        WHERE store_id=$1 
        ORDER BY sort_order, id
      `,
      values: [storeId],
    });
    const images = imageRows.map(r => ({ url: r.url }));

    /* ────────────── 3) 메뉴 ────────────── */
    const { rows: menuRows } = await pool.query({
      text: `
        SELECT category, name, price, image_url, description
        FROM combined_menu_items
        WHERE store_id=$1
        ORDER BY category, name
      `,
      values: [storeId],
    });
    const menus = menuRows.map(r => ({
      category: r.category ?? "기타",
      name: r.name,
      price: r.price ?? 0,
      image_url: r.image_url,
      description: r.description ?? ""
    }));

    /* ────────────── 4) 이벤트 ────────────── */
    const { rows: evRows } = await pool.query({
      text: `
        SELECT content 
        FROM combined_store_events 
        WHERE store_id=$1 
        ORDER BY ord
      `,
      values: [storeId],
    });
    const events = evRows.map(r => r.content).filter(Boolean);

    /* ────────────── 최종 응답 ────────────── */
    return res.json({
      ok: true,
      store,
      images,
      menus,
      events,
    });
  } catch (err) {
    console.error("[getCombinedStoreFull] error:", err);
    return res.status(500).json({
      ok: false,
      error: "DB fetch failed",
      message: err.message,
    });
  }
}


