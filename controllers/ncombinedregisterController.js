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
    business_number, business_name, business_type, business_category,
    business_hours, delivery_option, service_details,
    additional_desc, phone, homepage, instagram, facebook,
    facilities, pets_allowed, parking,
    postal_code, road_address, detail_address, created_at
  ) VALUES (
    $1,$2,$3,$4,$5,$6,
    $7,$8,$9,$10,$11,$12,
    $13,$14,$15,$16,$17,$18,NOW()
  )
  RETURNING id
`;

    const storeVals = [
      s(raw.businessNumber),                       // $1 → business_number
      s(raw.businessName),                         // $2 → business_name
      s(raw.businessType),                         // $3 → business_type
      s(raw.mainCategory || raw.subCategory),      // $4 → business_category
      s(raw.businessHours),                        // $5
      s(raw.deliveryOption),                       // $6
      s(raw.serviceDetails),                       // $7
      s(raw.additionalDesc),                       // $8
      s(raw.phone ?? raw.phoneNumber),             // $9
      s(raw.homepage),                             // $10
      s(raw.instagram),                            // $11
      s(raw.facebook),                             // $12
      s(raw.facilities),                           // $13
      b(raw.petsAllowed),                          // $14
      s(raw.parking),                              // $15
      s(raw.postalCode),                           // $16
      s(raw.roadAddress),                          // $17
      s(raw.detailAddress),                        // $18
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
        ON CONFLICT (store_id, name)
        DO UPDATE SET
          category    = EXCLUDED.category,
          price       = EXCLUDED.price,
          description = EXCLUDED.description,
          image_url   = COALESCE(EXCLUDED.image_url, combined_menu_items.image_url)
        `,
        [storeId, m.category, m.name, m.price, m.image_url, m.description]
      );
    }

    // ✅ 이벤트
    const ev1 = s(raw.event1);
    const ev2 = s(raw.event2);
    if (ev1) {
      await client.query(
        `INSERT INTO combined_store_events (store_id, ord, content) VALUES ($1,$2,$3)`,
        [storeId, 1, ev1]
      );
    }
    if (ev2) {
      await client.query(
        `INSERT INTO combined_store_events (store_id, ord, content) VALUES ($1,$2,$3)`,
        [storeId, 2, ev2]
      );
    }

    await client.query("COMMIT");
    console.log("[createCombinedStore] 성공:", storeId);
    return res.json({ ok: true, id: storeId });
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


