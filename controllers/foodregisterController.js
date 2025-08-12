// controllers/foodregisterController.js
// 맨 위 유틸
const SLOW_MS = 20000; // 20s 넘기면 실패로 끊자 (임시)
const withTimeout = (p, ms = SLOW_MS) =>
  Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("TIMEOUT")), ms))]);

// createFoodRegister 맨 처음에
console.time("[foodregister] total");
console.log("[foodregister] start",
  {
    storeImgs: (req.files?.["storeImages"] || []).length,
    menuImgs: (req.files?.["menuImage[]"] || []).length,
    bodyKeys: Object.keys(req.body || {}).length
  });

// DB 연결 직전에 (Pool은 그대로)
const client = await withTimeout(pool.connect(), 8000); // 8s 제한
console.log("[foodregister] db connected");

// COMMIT 직후
console.timeEnd("[foodregister] total");

// catch 블록에서
if (e && e.message === "TIMEOUT") {
  console.error("[foodregister] timeout");
  return res.status(504).json({ error: "upstream timeout" });
}





import { Pool } from "pg";
import path from "path";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // ssl: { rejectUnauthorized: false } // 필요 시 주석 해제(Neon)
});

/** 업로드된 파일 경로에서 '/uploads/파일명'만 추출 */
function toUploadsPath(file) {
  if (!file) return null;
  // multer가 public2/uploads/xxx 로 저장했다고 가정
  const idx = file.path.lastIndexOf("uploads");
  return idx >= 0 ? `/uploads/${file.path.slice(idx + "uploads/".length)}` : `/uploads/${file.filename}`;
}

/** "12,000" → 12000 */
function toInt(v) {
  if (v == null) return null;
  const n = String(v).replace(/[^\d]/g, "");
  return n ? parseInt(n, 10) : null;
}

/** 배열 보정: 단일값도 배열로 맞춰줌 */
function arr(v) {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

/** POST /foodregister  */
export async function createFoodRegister(req, res) {
  const client = await pool.connect();
  try {
    const form = req.body || {};
    const storeImages = req.files?.["storeImages"] || [];
    const menuFiles = req.files?.["menuImage[]"] || [];
    const bizCert = (req.files?.["businessCertImage"] || [])[0] || null;

    // 텍스트 필드들(폼 name은 foodregister.html과 1:1)
    const businessName = form.businessName?.trim();
    const businessType = form.businessType?.trim() || null;
    const businessCategory = form.businessCategory?.trim() || null;
    const deliveryOption = form.deliveryOption?.trim() || null; // 가능/불가 등
    const businessHours = form.businessHours?.trim() || null;
    const address = form.address?.trim() || null;
    const phone = form.phone?.trim() || null;

    if (!businessName) {
      return res.status(400).json({ error: "businessName is required" });
    }

    await client.query("BEGIN");

    // 1) store insert
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

    // 2) store images (대표 이미지들)
    if (storeImages.length > 0) {
      const insertImgSQL = `
        INSERT INTO food_store_images (store_id, image_url, sort_order)
        VALUES ${storeImages.map((_, i) => `($1, $${i + 2}, ${i})`).join(",")}
      `;
      const imgParams = [storeId, ...storeImages.map(f => toUploadsPath(f))];
      await client.query(insertImgSQL, imgParams);
    }

    // 3) 메뉴들 (이름/가격/카테고리 + 메뉴 이미지)
    //    - menuName[], menuPrice[], menuCategory[] 를 인덱스 기준으로 매칭
    const menuNames = arr(form["menuName[]"]);
    const menuPrices = arr(form["menuPrice[]"]);
    const menuCategories = arr(form["menuCategory[]"]);

    // menuFiles(업로드 이미지) 인덱스가 텍스트와 동일하다는 가정.
    // 만약 이미지가 일부만 올라오면 그 인덱스는 null 처리.
    const maxLen = Math.max(menuNames.length, menuPrices.length, menuCategories.length, menuFiles.length);

    const menuRows = [];
    for (let i = 0; i < maxLen; i++) {
      const name = menuNames[i]?.trim();
      const price = toInt(menuPrices[i]);
      const category = menuCategories[i]?.trim() || null;
      const img = menuFiles[i] ? toUploadsPath(menuFiles[i]) : null;

      // 이름/가격이 모두 있어야 저장
      if (name && price != null) {
        menuRows.push({ name, price, category, img });
      }
    }

    if (menuRows.length > 0) {
      const base = `INSERT INTO food_menu_items (store_id, category, name, price, image_url) VALUES `;
      const values = menuRows.map((_, i) => {
        const j = i * 4; // 4개씩 증가(category,name,price,image_url)
        return `($1, $${j + 2}, $${j + 3}, $${j + 4}, $${j + 5})`;
      }).join(",");

      const params = [
        storeId,
        ...menuRows.flatMap(r => [r.category, r.name, r.price, r.img])
      ];

      await client.query(base + values, params);
    }

    await client.query("COMMIT");

    return res.json({
      ok: true,
      storeId,
      businessCertImage: toUploadsPath(bizCert) // 필요 시 별도 테이블에 저장 고려
    });
  } catch (e) {
    try { await client.query("ROLLBACK"); } catch { }
    console.error("[createFoodRegister] error:", e);
    return res.status(500).json({ error: "create failed" });
  } finally {
    try { client.release(); } catch { }
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

    return res.json({
      ok: true,
      store: storeRows[0],
      images: imgRows.map(r => r.image_url)
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

