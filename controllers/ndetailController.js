
import { Pool } from "pg";
import path from "path";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // ssl: { rejectUnauthorized: false } // URL에 sslmode=require 없으면 주석 해제
});

/** ───────── UTILS ───────── **/
const SLOW_MS = 20000; // 20s 넘기면 타임아웃 응답
const withTimeout = (p, ms = SLOW_MS) =>
  Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("TIMEOUT")), ms))]);

/** 업로드된 파일 경로에서 '/uploads/파일명'만 추출 */
function toUploadsPath(file) {
  if (!file) return null;
  const idx = file.path?.lastIndexOf("uploads") ?? -1;
  if (idx >= 0) {
    const rel = file.path.slice(idx + "uploads/".length);
    return `/uploads/${rel}`;
  }
  return `/uploads/${file.filename}`;
}

/** "12,000" → 12000 */
function toInt(v) {
  if (v == null) return null;
  const n = String(v).replace(/[^\d]/g, "");
  return n ? parseInt(n, 10) : null;
}

/** 단일값도 배열로 맞춰줌 */
function arr(v) {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

/** ───────── CONTROLLERS ───────── **/
/** POST /foodregister  */
export async function createFoodRegister(req, res) {
  let client; // finally/rollback에서 가드
  console.time("[foodregister] total");
  console.log("[foodregister] start", {
    storeImgs: (req.files?.["storeImages"] || []).length,
    menuImgs: (req.files?.["menuImage[]"] || []).length,
    bodyKeys: Object.keys(req.body || {}).length
  });

  try {
    client = await withTimeout(pool.connect(), 8000);
    console.log("[foodregister] db connected");
    await client.query("BEGIN");

    const form = req.body || {};
    const storeImages = req.files?.["storeImages"] || [];
    const menuFiles = req.files?.["menuImage[]"] || [];
    const bizCert = (req.files?.["businessCertImage"] || [])[0] || null;

    // 필수 필드
    const businessName = form.businessName?.trim();
    const businessType = form.businessType?.trim() || null;
    const businessCategory = form.businessCategory?.trim() || null;
    const deliveryOption = form.deliveryOption?.trim() || null;
    const businessHours = form.businessHours?.trim() || null;
    const address = form.address?.trim() || null;
    const phone = form.phone?.trim() || null;

    if (!businessName) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "businessName is required" });
    }

    // 1) 가게 저장
    const insertStoreSQL = `
      INSERT INTO food_stores
        (business_name, business_type, business_category, delivery_option, business_hours, address, phone)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING id
    `;
    const storeParams = [
      businessName, businessType, businessCategory, deliveryOption, businessHours, address, phone
    ];
    const { rows } = await client.query(insertStoreSQL, storeParams);
    const storeId = rows[0].id;

    // 2) 대표 이미지들
    if (storeImages.length > 0) {
      const insertImgSQL =
        `INSERT INTO food_store_images (store_id, image_url, sort_order)
         VALUES ${storeImages.map((_, i) => `($1, $${i + 2}, ${i})`).join(",")}`;
      const imgParams = [storeId, ...storeImages.map(f => toUploadsPath(f))];
      await client.query(insertImgSQL, imgParams);
    }

    // 3) 메뉴들 (텍스트 & 이미지 인덱스 매칭)
    const menuNames = arr(form["menuName[]"]);
    const menuPrices = arr(form["menuPrice[]"]);
    const menuCategories = arr(form["menuCategory[]"]);
    const maxLen = Math.max(menuNames.length, menuPrices.length, menuCategories.length, menuFiles.length);

    const menuRows = [];
    for (let i = 0; i < maxLen; i++) {
      const name = menuNames[i]?.trim();
      const price = toInt(menuPrices[i]);
      const category = menuCategories[i]?.trim() || null;
      const img = menuFiles[i] ? toUploadsPath(menuFiles[i]) : null;
      if (name && price != null) menuRows.push({ name, price, category, img });
    }

    if (menuRows.length > 0) {
      const base = `INSERT INTO food_menu_items (store_id, category, name, price, image_url) VALUES `;
      const values = menuRows.map((_, i) => {
        const j = i * 4; // 4개씩 증가(category,name,price,image_url)
        return `($1, $${j + 2}, $${j + 3}, $${j + 4}, $${j + 5})`;
      }).join(",");
      const params = [storeId, ...menuRows.flatMap(r => [r.category, r.name, r.price, r.img])];
      await client.query(base + values, params);
    }

    await client.query("COMMIT");
    console.timeEnd("[foodregister] total");

    return res.json({
      ok: true,
      storeId,
      businessCertImage: toUploadsPath(bizCert) || null
    });
  } catch (e) {
    try { if (client) await client.query("ROLLBACK"); } catch { }
    if (e?.message === "TIMEOUT") {
      console.error("[foodregister] timeout");
      return res.status(504).json({ error: "upstream timeout" });
    }
    console.error("[createFoodRegister] error:", e);
    return res.status(500).json({ error: "create failed" });
  } finally {
    try { if (client) client.release(); } catch { }
  }
}

/** GET /foodregister/:id  */
export async function getFoodRegisterDetail(req, res) {
  const { id } = req.params;
  try {
    const { rows: storeRows } = await pool.query(
      `SELECT id, business_name, business_type, business_category,
                  delivery_option, business_hours, address, phone, NULL::timestamp AS created_at FROM food_stores WHERE id = $1`,
      [id]
    );
    if (storeRows.length === 0) {
      return res.status(404).json({ error: "not found" });
    }
    const { rows: imgRows } = await pool.query(
      `SELECT image_url, sort_order
       FROM food_store_images
       WHERE store_id = $1
       ORDER BY sort_order ASC, id ASC`,
      [id]
    );
    return res.json({ ok: true, store: storeRows[0], images: imgRows.map(r => r.image_url) });
  } catch (e) {
    console.error("[getFoodRegisterDetail] error:", e);
    return res.status(500).json({ error: "detail failed" });
  }
}

export async function getFoodRegisterFull(req, res) {
  const idNum = Number.parseInt(String(req.params.id), 10);
  if (!Number.isSafeInteger(idNum)) {
    return res.status(400).json({ ok: false, error: "Invalid id" });
  }

  try {
    // 1) 가게
    const { rows: s } = await pool.query(
      `SELECT id,
              business_name,
              address,
              phone,
              business_type, business_category, business_hours, delivery_option,
              NULL::timestamp AS created_at
         FROM food_stores
        WHERE id = $1`,
      [idNum]
    );
    if (!s.length) return res.status(404).json({ ok: false, error: "not_found" });

    // 2) 이미지: 두 테이블 합치기 -> {url} 형식으로 반환
    const { rows: images } = await pool.query(
      `
      SELECT url
        FROM store_images
       WHERE store_id = $1
      UNION ALL
      SELECT image_url AS url
        FROM food_store_images
       WHERE store_id = $1
      `,
      [idNum]
    );

    // 3) 메뉴: 3개 테이블 합치기 (image_url 없는 테이블은 NULL로 맞춤)
    let menus = [];
    try {
      // 뷰가 있으면 우선 사용(선택)
      const view = await pool.query(
        `SELECT store_id, COALESCE(category,'기타') AS category, name, price, image_url, description
           FROM v_store_menus
          WHERE store_id = $1
          ORDER BY category, name, price`,
        [idNum]
      );
      menus = view.rows;
    } catch (err) {
      if (err.code && err.code !== "42P01") throw err; // 뷰 없음이 아니면 그대로 에러

      // 뷰가 없으면 폴백 UNION
      const uni = await pool.query(
        `
        SELECT store_id,
               COALESCE(category,'기타') AS category,
               name,
               price,
               image_url,
               description
          FROM menu_items
         WHERE store_id = $1
        UNION ALL
        SELECT store_id,
               COALESCE(category,'기타') AS category,
               name,
               price,
               NULL::text AS image_url,
               description
          FROM store_menus
         WHERE store_id = $1
        UNION ALL
        SELECT store_id,
               COALESCE(category,'기타') AS category,
               name,
               price,
               image_url,
               description
          FROM food_menu_items
         WHERE store_id = $1
        ORDER BY category, name, price
        `,
        [idNum]
      );
      menus = uni.rows;
    }

    // 4) 이벤트(있으면)
    let events = [];
    try {
      const ev = await pool.query(
        `SELECT content FROM store_events WHERE store_id = $1 ORDER BY ord, id`,
        [idNum]
      );
      events = ev.rows.map(r => r.content);
    } catch { }

    return res.json({
      ok: true,
      store: s[0],
      images,  // [{ url: "/uploads/..." }, ...]
      menus,   // [{ category, name, price, image_url, description }, ...]
      events
    });
  } catch (e) {
    console.error("[getFoodRegisterFull] error:", e);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
}

/* 기존 export alias에 한 줄 추가해두면 과거 명칭도 호환됨 */
export const getFoodStoreFull = getFoodRegisterFull;
