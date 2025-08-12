// controllers/foodregisterController.js  (foodregister.html 전용)
import { Pool } from "pg";
import path from "path";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { require: true },
});

/* ───── 유틸 ───── */
const toBool = (v) => {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "boolean") return v;
  const s = String(v).trim().toLowerCase();
  if (["1","y","yes","true","on"].includes(s)) return true;
  if (["0","n","no","false","off"].includes(s)) return false;
  return null;
};
const toPublicPath = (absPath) => {
  if (!absPath) return null;
  const idx = absPath.lastIndexOf(`${path.sep}uploads${path.sep}`);
  if (idx === -1) return null;
  return absPath.slice(idx).replace(/\\/g, "/"); // "/uploads/xxx.png"
};
const ensureArray = (v) => (Array.isArray(v) ? v : v != null ? [v] : []);
const toNumber = (v) => {
  const n = Number(String(v).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

/* ───── POST /store ─────
 * foodregister.html 폼 name에 100% 맞춤
 * DB 스키마는 기존 성공했던 필드(안전 집합)만 저장:
 *  business_name, business_type, business_category, delivery_option,
 *  business_hours, service_details, events, facilities, pets_allowed, parking,
 *  phone, website, description, address
 */
export async function createFoodStore(req, res) {
  const client = await pool.connect();
  try {
    const b = req.body;

    // 필수
    const business_name = b.businessName ?? null;
    if (!business_name) {
      return res.status(400).json({ error: "businessName is required" });
    }

    // 선택/일반
    const business_type     = b.businessType ?? null;
    const business_category = b.businessCategory ?? null;
    const business_hours    = b.businessHours ?? null;
    const delivery_option   = b.deliveryOption ?? null;
    const service_details   = b.serviceDetails ?? null;

    // 프론트 스크립트에서 event1/2 → events로 합쳐 넣음
    const events            = b.events ?? null;

    const facilities        = b.facilities ?? null;
    const pets_allowed      = toBool(b.petsAllowed); // select: "true"/"false"/""
    const parking           = b.parking ?? null;     // 텍스트(예: 전용/유료 등)

    const phone             = b.phone ?? null;
    const website           = b.website ?? null;

    // 추가 설명 필드를 description에 매핑
    const description       = b.additionalDesc ?? null;

    // 주소: 프론트에서 이미 address로 합쳐 보냄(roadAddress + detailAddress)
    const address           = b.address ?? null;

    // 파일 경로(대표 이미지)
    const storeImages = (req.files?.["storeImages"] ?? []).map(f => toPublicPath(f.path)).filter(Boolean);

    // 메뉴 배열(name, price, category, desc, image[])
    const categories = ensureArray(b["category[]"] ?? b.category);
    const names      = ensureArray(b["menuName[]"] ?? b.menuName);
    const pricesRaw  = ensureArray(b["menuPrice[]"] ?? b.menuPrice);
    const descs      = ensureArray(b["menuDesc[]"] ?? b.menuDesc);
    const menuImgs   = (req.files?.["menuImage[]"] ?? req.files?.["menuImage"] ?? []).map(f => toPublicPath(f.path));

    await client.query("BEGIN");

    // 1) stores
    const insertStoreSql = `
      INSERT INTO stores (
        business_name, business_type, business_category,
        delivery_option, business_hours, service_details,
        events, facilities, pets_allowed, parking,
        phone, website, description, address
      ) VALUES (
        $1,$2,$3,
        $4,$5,$6,
        $7,$8,$9,$10,
        $11,$12,$13,$14
      )
      RETURNING id
    `;
    const { rows } = await client.query(insertStoreSql, [
      business_name, business_type, business_category,
      delivery_option, business_hours, service_details,
      events, facilities, pets_allowed, parking,
      phone, website, description, address,
    ]);
    const storeId = Number(rows[0].id);

    // 2) store_images
    for (let i = 0; i < storeImages.length; i++) {
      await client.query(
        `INSERT INTO store_images (store_id, path, sort_order) VALUES ($1, $2, $3)`,
        [storeId, storeImages[i], i + 1]
      );
    }

    // 3) menu_items
    const max = Math.max(categories.length, names.length, pricesRaw.length, descs.length);
    for (let i = 0; i < max; i++) {
      const name = (names[i] ?? "").trim();
      if (!name) continue;
      const price = toNumber(pricesRaw[i] ?? "");
      const category = categories[i] ?? null;
      const desc = descs[i] ?? null;
      const image_path = menuImgs[i] ?? null;

      await client.query(
        `INSERT INTO menu_items (store_id, category, name, price, image_path, is_available, description)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [storeId, category, name, price, image_path, true, desc]
      );
    }

    await client.query("COMMIT");
    return res.status(201).json({ ok: true, id: storeId });
  } catch (err) {
    try { await pool.query("ROLLBACK"); } catch {}
    console.error("[createFoodStore] error:", err);
    return res.status(500).json({ error: "createFoodStore failed", detail: String(err?.message || err) });
  } finally {
    client.release();
  }
}

/* ───── GET /store/:id (ndetail.html 재사용) ───── */
export async function getFoodStoreDetail(req, res) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "invalid id" });

  try {
    const storeSql = `
      SELECT 
        s.id,
        s.business_name      AS "businessName",
        s.business_type      AS "businessType",
        s.business_category  AS "businessCategory",
        s.delivery_option    AS "deliveryOption",
        s.business_hours     AS "businessHours",
        s.service_details    AS "serviceDetails",
        s.events             AS "events",
        s.facilities         AS "facilities",
        s.pets_allowed       AS "petsAllowed",
        s.parking            AS "parking",
        s.phone              AS "phone",
        s.website            AS "website",
        s.description        AS "description",
        s.address            AS "address",
        COALESCE(
          json_agg(si.path ORDER BY si.sort_order)
            FILTER (WHERE si.id IS NOT NULL),
          '[]'
        ) AS images
      FROM stores s
      LEFT JOIN store_images si ON si.store_id = s.id
      WHERE s.id = $1
      GROUP BY s.id
    `;
    const { rows: storeRows } = await pool.query(storeSql, [id]);
    if (storeRows.length === 0) return res.status(404).json({ error: "store not found" });

    const menuSql = `
      SELECT 
        category,
        name,
        price,
        image_path  AS "imagePath",
        is_available AS "isAvailable",
        description  AS "description"
      FROM menu_items
      WHERE store_id = $1
      ORDER BY id
    `;
    const { rows: menuRows } = await pool.query(menuSql, [id]);

    return res.json({ storeInfo: storeRows[0], menus: menuRows });
  } catch (err) {
    console.error("[getFoodStoreDetail] error:", err);
    return res.status(500).json({ error: "getFoodStoreDetail failed", detail: String(err?.message || err) });
  }
}

/* ───── GET /store/:id/menus ───── */
export async function getFoodStoreMenus(req, res) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "invalid id" });

  try {
    const { rows } = await pool.query(
      `SELECT 
         category, name, price,
         image_path AS "imagePath",
         is_available AS "isAvailable",
         description AS "description"
       FROM menu_items
       WHERE store_id = $1
       ORDER BY id`,
      [id]
    );
    return res.json(rows);
  } catch (err) {
    console.error("[getFoodStoreMenus] error:", err);
    return res.status(500).json({ error: "getFoodStoreMenus failed", detail: String(err?.message || err) });
  }
}
