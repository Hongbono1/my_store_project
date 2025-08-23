// controllers/ncombinedregisterController.js
import pool from "../db.js";
import path from "path";

function toWebPath(file) {
  return file?.path ? `/uploads/${path.basename(file.path)}` : null;
}
function collectFiles(req) {
  if (!req || !req.files) return [];
  if (Array.isArray(req.files)) return req.files;
  return Object.values(req.files).flat();
}

export async function createStore(req, res) {
  const client = await pool.connect();
  try {
    const raw = req.body;
    const files = collectFiles(req);

    await client.query("BEGIN");

    const certFile = files.find(f => f.fieldname === "businessCertImage");

    const { rows } = await client.query(
      `INSERT INTO ncombined_stores
       (business_name, business_type, business_category, business_subcategory,
        business_hours, delivery_option, service_details, facilities,
        pets_allowed, parking, phone, homepage, instagram, facebook,
        additional_desc, postal_code, road_address, detail_address,
        owner_name, birth_date, owner_email, owner_address, owner_phone, business_cert_path)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
               $11,$12,$13,$14,$15,$16,$17,$18,
               $19,$20,$21,$22,$23,$24,$25)
       RETURNING id`,
      [
        raw.businessName || null,
        raw.businessType || null,
        raw.businessCategory || null,
        raw.businessSubcategory || null,
        raw.businessHours || null,
        raw.deliveryOption || null,
        raw.serviceDetails || null,
        raw.facilities || null,
        raw.petsAllowed === "true" || raw.petsAllowed === "on",
        raw.parking === "true" || raw.parking === "on",
        raw.phone || null,
        raw.homepage || null,
        raw.instagram || null,
        raw.facebook || null,
        raw.additionalDesc || null,
        raw.postalCode || null,
        raw.roadAddress || null,
        raw.detailAddress || null,
        raw.ownerName || null,
        raw.birthDate || null,
        raw.ownerEmail || null,
        raw.ownerAddress || null,
        raw.ownerPhone || null,
        certFile ? toWebPath(certFile) : null,
      ]
    );

    const storeId = rows[0].id;

    // 가게 이미지
    const storeImgs = files.filter(f => f.fieldname === "storeImages");
    for (const img of storeImgs) {
      await client.query(
        `INSERT INTO ncombined_store_images (store_id, url) VALUES ($1,$2)`,
        [storeId, toWebPath(img)]
      );
    }

    // 메뉴
    const names = raw["menuName[]"] || [];
    const prices = raw["menuPrice[]"] || [];
    const cats = raw["menuCategory[]"] || [];
    const menuImgs = files.filter(f => f.fieldname === "menuImage[]");

    for (let i = 0; i < names.length; i++) {
      if (!names[i]) continue;
      await client.query(
        `INSERT INTO ncombined_store_menus (store_id, category, name, price, image_url)
         VALUES ($1,$2,$3,$4,$5)`,
        [
          storeId,
          cats[i] || null,
          names[i],
          prices[i] ? parseInt(prices[i]) : 0,
          menuImgs[i] ? toWebPath(menuImgs[i]) : null,
        ]
      );
    }

    await client.query("COMMIT");
    res.json({ ok: true, id: storeId });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("createStore error:", err);
    res.status(500).json({ ok: false, error: err.message });
  } finally {
    client.release();
  }
}
