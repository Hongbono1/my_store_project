// controllers/foodregisterController.js
import { Pool } from "pg";

// 🔌 Neon 연결 (DATABASE_URL에 sslmode=require 가 없다면 아래 ssl 주석 해제)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // ssl: { rejectUnauthorized: false },
});

/* ────────────── Utils ────────────── */

/** 20s 타임아웃 가드 */
const SLOW_MS = 20_000;
const withTimeout = (p, ms = SLOW_MS) =>
  Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("TIMEOUT")), ms))]);

/** 업로드된 파일 경로에서 '/uploads/파일명'만 추출 */
function toUploadsPath(file) {
  if (!file) return null;
  // multer가 public2/uploads/... 으로 저장한다고 가정
  const p = file.path || "";
  const idx = p.lastIndexOf("uploads");
  if (idx >= 0) {
    return "/uploads/" + p.slice(idx + "uploads/".length);
  }
  // fallback
  return file.filename ? `/uploads/${file.filename}` : null;
}

/** "12,000" -> 12000 (숫자 아니면 null) */
function toInt(v) {
  if (v == null) return null;
  const n = String(v).replace(/[^\d]/g, "");
  return n ? parseInt(n, 10) : null;
}

/** 단일값도 배열로 보정 */
function arr(v) {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

/* ────────────── Controllers ────────────── */

/** POST /foodregister */
export async function createFoodRegister(req, res) {
  let client;
  console.time("[foodregister] total");
  console.log("[foodregister] start", {
    storeImgs: (req.files?.["storeImages"] || []).length,
    menuImgs: (req.files?.["menuImage[]"] || []).length,
    bodyKeys: Object.keys(req.body || {}).length,
  });

  try {
    client = await withTimeout(pool.connect(), 8000);
    console.log("[foodregister] db connected");
    await client.query("BEGIN");

    const form = req.body || {};
    const storeImages = req.files?.["storeImages"] || [];
    const menuFiles   = req.files?.["menuImage[]"] || [];
    const bizCert     = (req.files?.["businessCertImage"] || [])[0] || null;

    // 텍스트 필드
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

    // 1) 매장 저장
    const insertStoreSQL = `
      INSERT INTO food_stores
        (business_name, business_type, business_category, delivery_option, business_hours, address, phone)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING id
    `;
    const storeParams = [
      businessName, businessType, businessCategory, deliveryOption, businessHours, address, phone,
    ];
    const { rows } = await client.query(insertStoreSQL, storeParams);
    const storeId = rows[0].id;

    // 2) 대표 이미지 저장 (있을 때만)
    if (storeImages.length > 0) {
      const insertImgSQL =
        `INSERT INTO food_store_images (store_id, image_url, sort_order)
         VALUES ${storeImages.map((_, i) => `($1, $${i + 2}, ${i})`).join(",")}`;
      const imgParams = [storeId, ...storeImages.map((f) => toUploadsPath(f))];
      await client.query(insertImgSQL, imgParams);
    }

    // 3) 메뉴 저장 (텍스트+이미지 인덱스 매칭)
    const menuNames      = arr(form["menuName[]"]);
    const menuPrices     = arr(form["menuPrice[]"]);
    const menuCategories = arr(form["menuCategory[]"]);

    const maxLen = Math.max(menuNames.length, menuPrices.length, menuCategories.length, menuFiles.length);
    const menuRows = [];
    for (let i = 0; i < maxLen; i++) {
      const name = menuNames[i]?.trim();
      const price = toInt(menuPrices[i]);
      const category = menuCategories[i]?.trim() || null;
      const img = menuFiles[i] ? toUploadsPath(menuFiles[i]) : null;

      if (name && price != null) {
        menuRows.push({ name, price, category, img });
      }
    }

    if (menuRows.length > 0) {
      const base = `INSERT INTO food_menu_items (store_id, category, name, price, image_url) VALUES `;
      const values = menuRows.map((_, i) => {
        const j = i * 4; // (cat, name, price, img) 4개씩
        return `($1, $${j + 2}, $${j + 3}, $${j + 4}, $${j + 5})`;
      }).join(",");
      const params = [storeId, ...menuRows.flatMap((r) => [r.category, r.name, r.price, r.img])];
      await client.query(base + values, params);
    }

    await client.query("COMMIT");
    console.timeEnd("[foodregister] total");

    return res.json({
      ok: true,
      storeId,
      businessCertImage: toUploadsPath(bizCert) || null, // 필요 시 별도 테이블 고려
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

/** GET /foodregister/:id */
export async function getFoodRegisterDetail(req, res) {
  const { id } = req.params;
  try {
    const { rows: storeRows } = await pool.query(
      `SELECT id, business_name, business_type, business_category,
              delivery_option, business_hours, address, phone, created_at
       FROM food_stores WHERE id = $1`,
      [id]
    );
    if (storeRows.length === 0) return res.status(404).json({ error: "not found" });

    const { rows: imgRows } = await pool.query(
      `SELECT image_url, sort_order
       FROM food_store_images
       WHERE store_id = $1
       ORDER BY sort_order ASC, id ASC`,
      [id]
    );

    return res.json({
      ok: true,
      store: storeRows[0],
      images: imgRows.map((r) => r.image_url),
    });
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

/* ───────── alias exports (라우터가 과거 이름을 써도 동작하도록) ───────── */
export const createFoodStore       = createFoodRegister;
export const getFoodStoreDetail    = getFoodRegisterDetail;
export const getFoodStoreMenus     = getFoodRegisterMenus;
