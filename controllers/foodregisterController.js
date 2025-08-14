// controllers/foodregisterController.js
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
    const menuFiles   = req.files?.["menuImage[]"] || [];
    const bizCert     = (req.files?.["businessCertImage"] || [])[0] || null;

    // 필수 필드
    const businessName     = form.businessName?.trim();
    const businessType     = form.businessType?.trim() || null;
    const businessCategory = form.businessCategory?.trim() || null;
    const deliveryOption   = form.deliveryOption?.trim() || null;
    const businessHours    = form.businessHours?.trim() || null;
    const address          = form.address?.trim() || null;
    const phone            = form.phone?.trim() || null;

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
    const menuNames       = arr(form["menuName[]"]);
    const menuPrices      = arr(form["menuPrice[]"]);
    const menuCategories  = arr(form["menuCategory[]"]);
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
    try { if (client) await client.query("ROLLBACK"); } catch {}
    if (e?.message === "TIMEOUT") {
      console.error("[foodregister] timeout");
      return res.status(504).json({ error: "upstream timeout" });
    }
    console.error("[createFoodRegister] error:", e);
    return res.status(500).json({ error: "create failed" });
  } finally {
    try { if (client) client.release(); } catch {}
  }
}

/** GET /foodregister/:id  */
export async function getFoodRegisterDetail(req, res) {
  const { id } = req.params;
  try {
    const { rows: storeRows } = await pool.query(
      `SELECT id, business_name, business_type, business_category,
              delivery_option, business_hours, address, phone, created_at
       FROM food_stores WHERE id = $1`,
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

/** GET /foodregister/:id/menus */
export async function getFoodRegisterMenus(req, res) {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT id, category, name, price, image_url, created_at
       FROM food_menu_items
       WHERE store_id = $1
       ORDER BY id ASC`,
      [id]
    );
    return res.json({ ok: true, menus: rows });
  } catch (e) {
    console.error("[getFoodRegisterMenus] error:", e);
    return res.status(500).json({ error: "menus failed" });
  }
}
// === appended: full detail handler ===
export async function getFoodRegisterFull(req, res) {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      `
      SELECT
        s.*,
        COALESCE(
          ARRAY_AGG(si.image_url ORDER BY si.sort_order, si.id)
          FILTER (WHERE si.id IS NOT NULL),
          '{}'
        ) AS images,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', m.id,
              'category', m.category,
              'name', m.name,
              'price', m.price,
              'image_url', m.image_url
            )
            ORDER BY m.id
          )
          FILTER (WHERE m.id IS NOT NULL),
          '[]'
        ) AS menus
      FROM food_stores s
      LEFT JOIN food_store_images si ON si.store_id = s.id
      LEFT JOIN food_menu_items  m  ON m.store_id  = s.id
      WHERE s.id = $1
      GROUP BY s.id
      `,
      [id]
    );

    if (rows.length === 0) return res.status(404).json({ error: "not found" });

    const { images, menus, ...store } = rows[0];
    return res.json({ ok: true, store, images, menus });
  } catch (e) {
    console.error("[getFoodRegisterFull] error:", e);
    return res.status(500).json({ error: "full failed" });
  }
}

// 과거 명칭 호환
export const getFoodStoreFull = getFoodRegisterFull;
