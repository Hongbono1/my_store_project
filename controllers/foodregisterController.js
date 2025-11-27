// controllers/foodregisterController.js
import pool from "../db.js";
import path from "path";

/* ===================== 공통 유틸 ====================== */
function parseId(v) {
  const n = Number.parseInt(String(v), 10);
  return Number.isSafeInteger(n) ? n : null;
}

function collectFiles(req) {
  if (!req.files) return [];
  return Object.values(req.files).flat();
}

function filesByField(files, ...names) {
  const set = new Set(names);
  return files.filter(f => set.has(f.fieldname));
}

function toWebPath(file) {
  if (!file) return null;
  const fname = file.filename || path.basename(file.path);
  return `/uploads/${fname}`;
}

function toInt(v) {
  return parseInt(String(v || "").replace(/[^\d]/g, ""), 10) || 0;
}

/* ===================== 메뉴 파싱 ====================== */
function parseMenus(body, menuFiles = []) {
  const names = [].concat(body["menuName[]"] || body.menuName || []);
  const prices = [].concat(body["menuPrice[]"] || body.menuPrice || []);
  const categories = [].concat(body["menuCategory[]"] || []);
  const descs = [].concat(body["menuDesc[]"] || []);
  const themes = [].concat(body["menuTheme[]"] || []);

  const list = [];
  for (let i = 0; i < names.length; i++) {
    const name = (names[i] || "").trim();
    const price = toInt(prices[i]);
    if (!name || price <= 0) continue;

    list.push({
      name,
      price,
      category: (categories[i] || "").trim() || null,
      description: (descs[i] || "").trim() || null,
      theme: (themes[i] || "").trim() || null,
      image_url: menuFiles[i] ? toWebPath(menuFiles[i]) : null
    });
  }
  return list;
}

/* ===================== 등록 ====================== */
export async function createFoodStore(req, res) {
  const client = await pool.connect();
  try {
    const data = req.body;

    const businessName = data.businessName?.trim();
    const roadAddress = data.roadAddress?.trim();
    if (!businessName || !roadAddress) {
      return res.json({ ok: false, error: "missing_required" });
    }

    await client.query("BEGIN");

    /* 1) store_info */
    const insertInfo = `
      INSERT INTO store_info (
        business_name, owner_name, phone, email, address,
        business_type, business_category, business_hours, delivery_option,
        service_details, additional_desc,
        homepage, instagram, facebook,
        facilities, pets_allowed, parking
      ) VALUES (
        $1,$2,$3,$4,$5,
        $6,$7,$8,$9,
        $10,$11,
        $12,$13,$14,
        $15,$16,$17
      ) RETURNING id
    `;

    const { rows } = await client.query(insertInfo, [
      businessName,
      data.ownerName || null,
      data.phone || null,
      data.ownerEmail || data.email || null,
      roadAddress,
      data.businessType || null,
      data.businessCategory || null,
      data.businessHours || null,
      data.deliveryOption || null,
      data.serviceDetails || null,
      data.additionalDesc || null,
      data.homepage || null,
      data.instagram || null,
      data.facebook || null,
      data.facilities || null,
      data.petsAllowed === "true",
      data.parking || null
    ]);

    const storeId = rows[0].id;

    /* 2) 이미지 */
    const allFiles = collectFiles(req);
    const storeImages = filesByField(allFiles, "storeImages", "storeImages[]");

    if (storeImages.length) {
      const urls = storeImages.map(toWebPath).filter(Boolean);
      const q = `
        INSERT INTO store_images (store_id, url, sort_order)
        VALUES ${urls.map((_, i) => `($1,$${i + 2},${i})`).join(",")}
      `;
      await client.query(q, [storeId, ...urls]);
    }

    /* 3) 메뉴 */
    const menuFiles = filesByField(allFiles, "menuImage", "menuImage[]");
    const menus = parseMenus(req.body, menuFiles);

    if (menus.length) {
      const q = `
        INSERT INTO store_menu (store_id, name, price, category, image_url, description, theme)
        VALUES ${menus
          .map(
            (_, i) =>
              `($1,$${i * 6 + 2},$${i * 6 + 3},$${i * 6 + 4},$${i * 6 + 5},$${i * 6 + 6},$${i * 6 + 7})`
          )
          .join(",")}
      `;

      const params = menus.flatMap(m => [
        m.name,
        m.price,
        m.category,
        m.image_url,
        m.description,
        m.theme
      ]);

      await client.query(q, [storeId, ...params]);
    }

    /* 4) 이벤트 */
    const events = Object.entries(req.body)
      .filter(([k]) => /^event\d+$/i.test(k))
      .map(([_, v]) => (v || "").trim())
      .filter(Boolean);

    if (events.length) {
      const q = `
        INSERT INTO store_events (store_id, content, ord)
        VALUES ${events.map((_, i) => `($1,$${i + 2},${i})`).join(",")}
      `;
      await client.query(q, [storeId, ...events]);
    }

    await client.query("COMMIT");
    return res.json({ ok: true, id: storeId });
  } catch (err) {
    console.error("createFoodStore:", err);
    await client.query("ROLLBACK");
    return res.status(500).json({ ok: false });
  } finally {
    client.release();
  }
}

/* ===================== 상세 조회 ====================== */
export async function getStoreFull(req, res) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ ok: false });

    /* 1) store_info */
    const { rows: infoRows } = await pool.query(
      `SELECT * FROM store_info WHERE id=$1`,
      [id]
    );
    if (!infoRows.length) return res.status(404).json({ ok: false });

    const info = infoRows[0];

    /* 2) store_images */
    const { rows: imgRows } = await pool.query(
      `SELECT url FROM store_images WHERE store_id=$1 ORDER BY sort_order`,
      [id]
    );

    /* 3) store_menu */
    const { rows: menuRows } = await pool.query(
      `SELECT name, price, category, image_url, description, theme
         FROM store_menu
        WHERE store_id=$1
        ORDER BY id`,
      [id]
    );

    /* 4) store_events */
    const { rows: eventRows } = await pool.query(
      `SELECT content FROM store_events WHERE store_id=$1 ORDER BY ord`,
      [id]
    );

    return res.json({
      ok: true,
      data: {
        ...info,
        images: imgRows.map(r => r.url),
        menus: menuRows,
        events: eventRows.map(r => r.content)
      }
    });
  } catch (err) {
    console.error("getStoreFull:", err);
    return res.status(500).json({ ok: false });
  }
}

/* ===================== 수정 ====================== */
export async function updateFoodStore(req, res) {
  const client = await pool.connect();
  try {
    const id = parseId(req.params.id);
    if (!id) return res.json({ ok: false });

    await client.query("BEGIN");

    /* 1) store_info 업데이트 */
    const fields = {
      business_name: req.body.businessName,
      owner_name: req.body.ownerName,
      phone: req.body.phone,
      email: req.body.email,
      address: req.body.roadAddress,
      business_type: req.body.businessType,
      business_category: req.body.businessCategory,
      business_hours: req.body.businessHours,
      delivery_option: req.body.deliveryOption,
      service_details: req.body.serviceDetails,
      additional_desc: req.body.additionalDesc,
      homepage: req.body.homepage,
      instagram: req.body.instagram,
      facebook: req.body.facebook,
      facilities: req.body.facilities,
      pets_allowed: req.body.petsAllowed === "true",
      parking: req.body.parking
    };

    const set = [];
    const params = [];
    Object.entries(fields).forEach(([col, val]) => {
      if (val !== undefined) {
        set.push(`${col}=$${params.length + 1}`);
        params.push(val === "" ? null : val);
      }
    });

    if (set.length) {
      await client.query(
        `UPDATE store_info SET ${set.join(", ")} WHERE id=$${params.length + 1}`,
        [...params, id]
      );
    }

    /* 2) 이미지가 다시 들어왔으면 삭제 후 재삽입 */
    const allFiles = collectFiles(req);
    const newImages = filesByField(allFiles, "storeImages", "storeImages[]");

    if (newImages.length) {
      await client.query(`DELETE FROM store_images WHERE store_id=$1`, [id]);
      const urls = newImages.map(toWebPath);

      const q = `
        INSERT INTO store_images (store_id, url, sort_order)
        VALUES ${urls.map((_, i) => `($1,$${i + 2},${i})`).join(",")}
      `;
      await client.query(q, [id, ...urls]);
    }

    /* 3) 메뉴 재작성 */
    await client.query(`DELETE FROM store_menu WHERE store_id=$1`, [id]);
    const menuFiles = filesByField(allFiles, "menuImage", "menuImage[]");
    const menus = parseMenus(req.body, menuFiles);

    if (menus.length) {
      const q = `
        INSERT INTO store_menu (store_id, name, price, category, image_url, description, theme)
        VALUES ${menus
          .map(
            (_, i) =>
              `($1,$${i * 6 + 2},$${i * 6 + 3},$${i * 6 + 4},$${i * 6 + 5},$${i * 6 + 6},$${i * 6 + 7})`
          )
          .join(",")}
      `;
      const params = menus.flatMap(m => [
        m.name,
        m.price,
        m.category,
        m.image_url,
        m.description,
        m.theme
      ]);
      await client.query(q, [id, ...params]);
    }

    /* 4) 이벤트 재작성 */
    await client.query(`DELETE FROM store_events WHERE store_id=$1`, [id]);
    const events = Object.entries(req.body)
      .filter(([k]) => /^event\d+$/.test(k))
      .map(([, v]) => v?.trim())
      .filter(Boolean);

    if (events.length) {
      const q = `
        INSERT INTO store_events (store_id, content, ord)
        VALUES ${events.map((_, i) => `($1,$${i + 2},${i})`).join(",")}
      `;
      await client.query(q, [id, ...events]);
    }

    await client.query("COMMIT");
    return res.json({ ok: true, id });
  } catch (err) {
    console.error("updateFoodStore:", err);
    await client.query("ROLLBACK");
    return res.json({ ok: false });
  } finally {
    client.release();
  }
}
