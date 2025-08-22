// controllers/ncombinedregisterController.js
import pool from "../db.js";
import path from "path";

/* 웹 경로 변환 */
function toWebPath(file) {
  return file?.path ? `/uploads/${path.basename(file.path)}` : null;
}

/* 파일 수집 */
function collectFiles(req) {
  if (!req || !req.files) return [];
  if (Array.isArray(req.files)) return req.files;
  return Object.values(req.files).flat();
}

/* =========================================
 * 가게 등록
 * =======================================*/
export async function createStore(req, res) {
  const client = await pool.connect();
  try {
    const raw = req.body;

    await client.query("BEGIN");

    // 1) store 저장
    const storeSql = `
      INSERT INTO ncombined_stores
      (business_name, business_type, business_category, business_subcategory,
       business_hours, delivery_option, service_details, facilities, pets_allowed,
       parking, phone, homepage, instagram, facebook, additional_desc,
       postal_code, road_address, detail_address, owner_name, birth_date,
       owner_email, owner_address, owner_phone, business_cert_path)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
              $16,$17,$18,$19,$20,$21,$22,$23,$24)
      RETURNING id
    `;

    const values = [
      raw.businessName,
      raw.businessType,
      raw.businessCategory,
      raw.businessSubcategory,
      raw.businessHours,
      raw.deliveryOption,
      raw.serviceDetails,
      raw.facilities,
      raw.petsAllowed,
      raw.parking,
      raw.phone,
      raw.homepage,
      raw.instagram,
      raw.facebook,
      raw.additionalDesc,
      raw.postalCode,
      raw.roadAddress,
      raw.detailAddress,
      raw.ownerName,
      raw.birthDate,
      raw.ownerEmail,
      raw.ownerAddress,
      raw.ownerPhone,
      (collectFiles(req).find(f => f.fieldname === "businessCertImage") ? 
        toWebPath(collectFiles(req).find(f => f.fieldname === "businessCertImage")) : null),
    ];

    const { rows } = await client.query(storeSql, values);
    const storeId = rows[0].id;

    // 2) 가게 이미지 저장
    const storeImgs = collectFiles(req).filter(f =>
      ["storeImages"].includes(f.fieldname)
    );
    for (const img of storeImgs) {
      await client.query(
        `INSERT INTO ncombined_store_images (store_id, url) VALUES ($1,$2)`,
        [storeId, toWebPath(img)]
      );
    }

    // 3) 메뉴 저장
    const names = Array.isArray(raw.menuName) ? raw.menuName : [raw.menuName];
    const prices = Array.isArray(raw.menuPrice) ? raw.menuPrice : [raw.menuPrice];
    const cats = Array.isArray(raw.menuCategory) ? raw.menuCategory : [raw.menuCategory];

    const menuImgs = collectFiles(req).filter(f =>
      ["menuImage"].includes(f.fieldname)
    );

    for (let i = 0; i < names.length; i++) {
      if (!names[i]) continue;
      const imgFile = menuImgs[i] || null;
      await client.query(
        `INSERT INTO ncombined_store_menus (store_id, category, name, price, image_url)
         VALUES ($1,$2,$3,$4,$5)`,
        [storeId, cats[i] || null, names[i], prices[i] || 0, toWebPath(imgFile)]
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
