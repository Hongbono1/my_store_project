import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import { pool } from "../db/pool.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ────────────────────── 업로드 디렉터리 설정 ──────────────────────
const uploadDir = path.join(__dirname, "..", "public", "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    const base = path.basename(file.originalname || "file", ext).replace(/\s+/g, "_");
    const uniq = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `${base}-${uniq}${ext}`);
  },
});
export const upload = multer({ storage });

/* ------------------------------------------------------------------
 * POST /store  (등록) — DB INSERT 예시 (store_info / store_menu)
 * ----------------------------------------------------------------*/
export const createStore = [
  upload.single("businessCertImage"), // 샘플: 사업자등록증 1장만 사용
  async (req, res) => {
    const body = req.body || {};
    try {
      // 1) store_info INSERT
      const insertStoreSQL = `INSERT INTO store_info (
        business_name, business_type, delivery_option,
        business_hours, service_details, address, phone_number
      ) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`;

      const storeVals = [
        body.businessName,
        body.mainCategory,
        body.deliveryOption,
        body.businessHours,
        body.serviceDetails,
        combinedAddress,
        body.ownerAddress,
        body.phoneNumber,
      ];

      const sRes = await pool.query(insertStoreSQL, storeVals);
      const storeId = sRes.rows[0].id;

      // 2) 메뉴 배열 INSERT (있다면)
      const menuNames  = Array.isArray(body.menuName)  ? body.menuName  : body["menuName[]"]  || [];
      const menuPrices = Array.isArray(body.menuPrice) ? body.menuPrice : body["menuPrice[]"] || [];
      for (let i = 0; i < menuNames.length; i++) {
        const mSQL = `INSERT INTO store_menu (store_id, menu_name, menu_price) VALUES ($1,$2,$3)`;
        await pool.query(mSQL, [storeId, menuNames[i], menuPrices[i] || 0]);
      }

      return res.status(201).json({ ok: true, storeId, redirect: `/new/ndetail.html?id=${storeId}` });
    } catch (err) {
      console.error("[createStore] DB 오류:", err);
      return res.status(500).json({ ok: false, message: "DB 오류" });
    }
  },
];

/* ------------------------------------------------------------------
 * GET /store/:id  (상세 조회) — 메뉴 + 가게 정보
 * ----------------------------------------------------------------*/
export async function getStoreDetail(req, res) {
  console.log(`[getStoreDetail] 호출, id=${req.params.id}`);
  const storeId = req.params.id;

  const storeQuery = `
    SELECT
      id,
      owner_id AS "ownerId",
      business_name AS "businessName",
      business_type AS "businessType",
      delivery_option AS "deliveryOption",
      business_hours AS "businessHours",
      service_details AS "serviceDetails",
      event1, event2,
      facility, pets, parking,
      phone_number AS "phoneNumber",
      homepage, instagram, facebook,
      additional_desc AS "additionalDesc",
      address,
      image1, image2, image3,
      created_at AS "createdAt",
      business_category AS "businessCategory",
      business_subcategory AS "businessSubcategory",
      description,
      search_count AS "searchCount",
      view_count AS "viewCount",
      click_count AS "clickCount"
    FROM store_info
    WHERE id = $1`;

  const menuQuery = `SELECT id, store_id, menu_name, menu_price, menu_image, category FROM store_menu WHERE store_id = $1`;

  try {
    const storeResult = await pool.query(storeQuery, [storeId]);
    const store = storeResult.rows[0];
    if (!store) {
      return res.status(404).json({ success: false, message: "해당 가게 없음" });
    }
    const menuResult = await pool.query(menuQuery, [storeId]);
    store.images = [store.image1, store.image2, store.image3].filter(Boolean);
    return res.json({ store, menus: menuResult.rows });
  } catch (err) {
    console.error("[getStoreDetail] DB 오류:", err);
    return res.status(500).json({ success: false, message: "DB 오류" });
  }
}