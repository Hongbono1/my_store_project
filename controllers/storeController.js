import { pool } from "../db/pool.js";
import bcrypt from "bcrypt";

/* GET /store?category=한식 */
export async function getStores(req, res) {
  const { category } = req.query;
  try {
    const { rows } = await pool.query(
      `SELECT id,
              business_name       AS "businessName",
              business_category   AS category,
              COALESCE(image1,'') AS thumb
         FROM store_info
        WHERE $1::text IS NULL OR business_category = $1`,
      [category || null],
    );
    res.json(rows);
  } catch (err) {
    console.error("❌ getStores", err);
    res.status(500).json({ message: "DB error" });
  }
}

/* GET /store/:id */
export async function getStoreDetail(req, res) {
  const { id } = req.params;
  try {
    const storeQ = await pool.query(`SELECT * FROM store_info WHERE id=$1`, [id]);
    if (!storeQ.rowCount)
      return res.status(404).json({ message: "가게 정보를 찾을 수 없습니다." });

    const menuQ = await pool.query(
      `SELECT COALESCE(NULLIF(trim(category),''),'기타') AS category,
              menu_name  AS "menuName",
              menu_price AS "menuPrice",
              menu_image AS "menuImageUrl"
         FROM store_menu
        WHERE store_id = $1`,
      [id],
    );

    const s = storeQ.rows[0];
    const eventsArr = [s.event1, s.event2].filter(Boolean);
    const addInfoArr = [s.facility, s.pets, s.parking].filter(Boolean);

    res.json({
      store: {
        businessName:  s.business_name,
        businessType:  s.business_type,
        deliveryOption:s.delivery_option,
        businessHours: s.business_hours,
        serviceDetails:s.service_details,
        contactPhone:  s.phone_number,
        homepage:      s.homepage,
        instagram:     s.instagram,
        facebook:      s.facebook,
        additionalDesc:s.additional_desc,
        address:       s.address,
        images:        [s.image1, s.image2, s.image3].filter(Boolean),
        events:        eventsArr,
        additionalInfo:addInfoArr,
      },
      menu: menuQ.rows,
    });
  } catch (err) {
    console.error("❌ getStoreDetail", err);
    res.status(500).json({ message: "DB error" });
  }
}

/* POST /store  (등록) */
export async function createStore(req, res) {
  const {
    bizNumber1, bizNumber2, bizNumber3,
    ownerName, birthDate, ownerEmail, ownerAddress, ownerPhone,
    businessName, businessCategory, businessSubcategory,
    businessType, deliveryOption, businessHours,
    serviceDetails, event1, event2, facility, pets, parking,
    phoneNumber, homepage, instagram, facebook, additionalDesc,
    postalCode, roadAddress, detailAddress,
  } = req.body;

  const bizNumber = `${bizNumber1}${bizNumber2}${bizNumber3}`;
  const fullStoreAddress = `${postalCode} ${roadAddress} ${detailAddress}`.trim();

  const imagePaths = (req.files["images[]"] || []).map(f => "/uploads/" + f.filename);
  const certPath   = req.files["businessCertImage"]?.[0]
                   ? "/uploads/" + req.files["businessCertImage"][0].filename
                   : null;

  const salt = await bcrypt.genSalt(10);
  const hashedBiz   = await bcrypt.hash(bizNumber,   salt);
  const hashedPhone = await bcrypt.hash(ownerPhone || "", salt);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    /* 1) owner_info */
    const { rows: ownerRows } = await client.query(
      `INSERT INTO owner_info
         (biz_number, name, birth_date, email, address, phone, cert_image)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [hashedBiz, ownerName, birthDate, ownerEmail, ownerAddress, hashedPhone, certPath],
    );
    const ownerId = ownerRows[0].id;

    /* 2) store_info */
    const { rows: storeRows } = await client.query(
      `INSERT INTO store_info (
         owner_id, business_name, business_category, business_subcategory,
         business_type, delivery_option, business_hours,
         service_details, event1, event2, facility, pets, parking,
         phone_number, homepage, instagram, facebook,
         additional_desc, address, image1, image2, image3)
       VALUES (
         $1,$2,$3,$4,$5,$6,$7,
         $8,$9,$10,$11,$12,$13,
         $14,$15,$16,$17,$18,$19,$20,$21,$22)
       RETURNING id`,
      [
        ownerId, businessName, businessCategory, businessSubcategory,
        businessType, deliveryOption, businessHours,
        serviceDetails, event1, event2, facility, pets, parking,
        phoneNumber, homepage, instagram, facebook,
        additionalDesc, fullStoreAddress,
        imagePaths[0] || null, imagePaths[1] || null, imagePaths[2] || null,
      ],
    );
    const storeId = storeRows[0].id;

    /* 3) 메뉴 */
    const categories   = [].concat(req.body.menuCategory || []);
    const menuNames    = [].concat(req.body.menuName    || []);
    const menuPrices   = [].concat(req.body.menuPrice   || []);
    const descriptions = [].concat(req.body.menuDesc    || []);
    const menuImages   = req.files["menuImage[]"] || [];

    for (let i = 0; i < menuNames.length; i++) {
      const price = parseInt((menuPrices[i] || "0").replace(/[^\d]/g, ""), 10);
      await client.query(
        `INSERT INTO store_menu
           (store_id, category, menu_name, menu_price, menu_image, menu_desc)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          storeId,
          categories[i] || "기타",
          menuNames[i] || "",
          price || 0,
          menuImages[i]?.filename ? "/uploads/" + menuImages[i].filename : null,
          descriptions[i] || "",
        ],
      );
    }

    await client.query("COMMIT");
    res.json({ message: "등록 성공", storeId });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ createStore", err);
    res.status(500).json({ message: "DB error", error: err.message });
  } finally {
    client.release();
  }
}
