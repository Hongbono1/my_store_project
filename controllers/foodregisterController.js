// controllers/foodregisterController.js
import pool from "../db.js";
import path from "path";

// 공통: 숫자 ID 가드
function parseId(raw) {
  const n = Number.parseInt(raw, 10);
  return Number.isSafeInteger(n) ? n : null;
}

/**
 * 등록: FormData (multipart/form-data)
 * 필수: businessName, roadAddress
 * 선택: phone, storeImages[*], storeMenus[i][j][{category|name|price}]
 * 응답: { ok:true, id }
 */
export async function createFoodStore(req, res) {
  const client = await pool.connect();
  try {
    const businessName = (req.body.businessName || "").trim();
    const roadAddress = (req.body.roadAddress || "").trim();
    const phone = (req.body.phone || "").trim();

    if (!businessName || !roadAddress) {
      return res.status(400).json({ ok: false, error: "businessName, roadAddress는 필수" });
    }

    await client.query("BEGIN");

    // 1) 기본 정보 저장
    const insertStoreQ = `
      INSERT INTO food_stores (business_name, road_address, phone)
      VALUES ($1, $2, $3)
      RETURNING id
    `;
    const { rows } = await client.query(insertStoreQ, [businessName, roadAddress, phone || null]);
    const storeId = rows[0].id;

    // 2) 이미지 저장 (multer.diskStorage 기준)
    const files = Array.isArray(req.files) ? req.files : (req.files?.storeImages || []);
    if (files.length) {
      const urls = files.map(f =>
        f.path ? `/uploads/${path.basename(f.path)}` : (f.filename ? `/uploads/${f.filename}` : null)
      ).filter(Boolean);
      if (urls.length) {
        const values = urls.map((_, i) => `($1,$${i + 2})`).join(",");
        await client.query(
          `INSERT INTO store_images (store_id, url) VALUES ${values}`,
          [storeId, ...urls]
        );
      }
    }

    // 3) 메뉴 저장 (FormData 평탄화: storeMenus[i][j][category|name|price])
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

    await client.query("COMMIT");
    return res.json({ ok: true, id: storeId });
  } catch (err) {
    await pool.query("ROLLBACK").catch(() => { });
    console.error("[createFoodStore] error:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  } finally {
    client.release();
  }
}

/**
 * 기본 조회: /foodregister/:id
 * 응답: { ok:true, store:{...} } | 404
 */
export async function getFoodStoreById(req, res) {
  try {
    const idNum = parseId(req.params.id);
    if (!idNum) return res.status(400).json({ ok: false, error: "Invalid id" });

    const q = `
      SELECT
        id,
        business_name AS "businessName",
        road_address  AS "roadAddress",
        phone,
        created_at    AS "createdAt"
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
 * - ndetail.html이 기대하는 구조(store, images[], menus[])로 응답
 */
export async function getFoodRegisterFull(req, res) {
  try {
    const idNum = parseId(req.params.id);
    if (!idNum) return res.status(400).json({ ok: false, error: "Invalid id" });

    // 1) 가게 기본정보 (ndetail은 address 키를 사용 → road_address 별칭)
    const { rows: s } = await pool.query(
      `SELECT id, business_name, road_address AS address, phone, created_at
       FROM food_stores WHERE id=$1`,
      [idNum]
    );
    if (!s.length) return res.status(404).json({ ok: false, error: "not_found" });

    // 2) 이미지
    const { rows: images } = await pool.query(
      `SELECT id, url
       FROM store_images
       WHERE store_id=$1
       ORDER BY id ASC`,
      [idNum]
    );

    // 3) 메뉴
    const { rows: menus } = await pool.query(
      `SELECT id, name, price, COALESCE(category,'기타') AS category, image_url
       FROM menu_items
       WHERE store_id=$1
       ORDER BY id ASC`,
      [idNum]
    );

    return res.json({ ok: true, store: s[0], images, menus });
  } catch (err) {
    console.error("[getFoodRegisterFull] error:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
}
