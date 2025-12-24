import fs from "fs";
import path from "path";
import crypto from "crypto";
import pool from "../db.js";

export const UPLOAD_SUBDIR = "manager_ad";
export const UPLOAD_ABS_DIR = path.join("/data/uploads", UPLOAD_SUBDIR);
export const UPLOAD_PUBLIC_PREFIX = `/uploads/${UPLOAD_SUBDIR}`;

const SLOTS_TABLE = "public.admin_ad_slots";

// ✅ ncategory2는 combined_store_info 기준(표시용 업종 JOIN)
const STORE_TABLE = "public.combined_store_info";

function ensureUploadDir() {
  fs.mkdirSync(UPLOAD_ABS_DIR, { recursive: true });
}

function clean(v) {
  if (v === undefined || v === null) return "";
  return String(v).trim();
}

function digitsOnly(v) {
  return clean(v).replace(/[^\d]/g, "");
}

function safeIntOrNull(v) {
  const s = clean(v);
  if (!s) return null;
  const n = Number(String(s).replace(/[^\d-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function toBool(v) {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "true" || s === "1" || s === "yes" || s === "y" || s === "on";
}

// ✅ DB 체크 제약: slot_type 은 banner/text만 허용
function normalizeSlotType(slot_type, slot_mode) {
  const st = clean(slot_type).toLowerCase();
  const sm = clean(slot_mode).toLowerCase();

  // 프론트에서 image 라고 보내도 DB는 banner
  if (st === "image") return "banner";
  if (st === "banner" || st === "text") return st;

  // slot_mode 기준으로 추론
  if (sm === "text") return "text";
  return "banner";
}

/** multer storage factory */
export function makeMulterStorage() {
  ensureUploadDir();

  return {
    destination: (_req, _file, cb) => cb(null, UPLOAD_ABS_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase();
      const name = `${Date.now()}_${crypto.randomBytes(6).toString("hex")}${ext || ""}`;
      cb(null, name);
    },
  };
}

export function fileFilter(_req, file, cb) {
  const ok = /^image\/(png|jpe?g|gif|webp|bmp)$/i.test(file.mimetype || "");
  if (!ok) return cb(new Error("Only image files are allowed"));
  cb(null, true);
}

/** GET /slots?page=ncategory2 */
export async function listSlots(req, res) {
  try {
    const page = clean(req.query.page) || "ncategory2";

    const sql = `
      SELECT
        s.id,
        s.page,
        s.position,
        s.priority,
        s.slot_type,
        s.slot_mode,
        s.store_id,
        s.business_no,
        s.business_name,
        COALESCE(NULLIF(s.image_url,''), NULLIF(c.main_image_url,''), '') AS image_url,
        s.link_url,
        s.text_content,
        s.created_at,
        s.updated_at,
        s.start_date,
        s.end_date,
        s.no_end,
        s.start_at,
        s.end_at,
        s.store_type,
        s.table_source,

        COALESCE(c.business_category, '') AS business_category
      FROM ${SLOTS_TABLE} s
      LEFT JOIN ${STORE_TABLE} c
        ON c.id::text = s.store_id::text
       AND (
            s.table_source = 'combined_store_info'
         OR s.table_source = 'combined'
         OR s.table_source IS NULL
         OR s.table_source = ''
       )
      WHERE s.page = $1
      ORDER BY s.position ASC, s.priority ASC NULLS FIRST
    `;

    const { rows } = await pool.query(sql, [page]);
    return res.json({ success: true, slots: rows });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
}

/** GET /slot?page=...&position=...&priority=... */
export async function getSlot(req, res) {
  try {
    const page = clean(req.query.page) || "ncategory2";
    const position = clean(req.query.position);
    const priority = safeIntOrNull(req.query.priority); // "" -> null

    if (!position) return res.json({ success: true, slot: null });

    const sql = `
      SELECT
        s.id,
        s.page,
        s.position,
        s.priority,
        s.slot_type,
        s.slot_mode,
        s.store_id,
        s.table_source,

        -- ✅ 슬롯에 저장된 값이 비어있으면 가게 테이블 값으로 보강
        COALESCE(NULLIF(s.business_name,''), c.business_name, '') AS business_name,
        COALESCE(
          NULLIF(s.business_no,''),
          regexp_replace(COALESCE(c.business_number::text,''), '[^0-9]', '', 'g'),
          ''
        ) AS business_no,

        COALESCE(NULLIF(s.image_url,''), NULLIF(c.main_image_url,''), '') AS image_url,
        s.link_url,
        s.text_content,
        s.created_at,
        s.updated_at,
        s.start_date,
        s.end_date,
        s.no_end,
        s.start_at,
        s.end_at,
        s.store_type,

        COALESCE(c.business_category, '') AS business_category
      FROM ${SLOTS_TABLE} s
      LEFT JOIN ${STORE_TABLE} c
        ON c.id::text = s.store_id::text
       AND (
            s.table_source = 'combined_store_info'
         OR s.table_source = 'combined'
         OR s.table_source IS NULL
         OR s.table_source = ''
       )
      WHERE s.page = $1
        AND s.position = $2
        AND (s.priority IS NOT DISTINCT FROM $3)
      ORDER BY s.position ASC, s.priority ASC NULLS FIRST
      LIMIT 1
    `;

    const { rows } = await pool.query(sql, [page, position, priority]);
    return res.json({ success: true, slot: rows[0] || null });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
}

/** ✅ GET /slot-items?page=...&position=... : 프론트가 호출하는 후보 목록 */
export async function listSlotItems(req, res) {
  try {
    const page = clean(req.query.page) || "ncategory2";
    const position = clean(req.query.position);

    if (!position) return res.json({ success: true, items: [] });

    const sql = `
      SELECT
        s.id,
        s.page,
        s.position,
        s.priority,
        s.slot_type,
        s.slot_mode,
        s.store_id,
        s.table_source,

        COALESCE(NULLIF(s.business_name,''), c.business_name, '') AS business_name,
        COALESCE(
          NULLIF(s.business_no,''),
          regexp_replace(COALESCE(c.business_number::text,''), '[^0-9]', '', 'g'),
          ''
        ) AS business_no,

        COALESCE(NULLIF(s.image_url,''), NULLIF(c.main_image_url,''), '') AS image_url,
        s.link_url,
        s.text_content,
        s.created_at,
        s.updated_at,
        s.start_date,
        s.end_date,
        s.no_end,
        s.start_at,
        s.end_at,
        s.store_type,

        COALESCE(c.business_category, '') AS business_category
      FROM ${SLOTS_TABLE} s
      LEFT JOIN ${STORE_TABLE} c
        ON c.id::text = s.store_id::text
       AND (
            s.table_source = 'combined_store_info'
         OR s.table_source = 'combined'
         OR s.table_source IS NULL
         OR s.table_source = ''
       )
      WHERE s.page = $1
        AND s.position = $2
      ORDER BY s.priority ASC NULLS FIRST, s.updated_at DESC
      LIMIT 50
    `;

    const { rows } = await pool.query(sql, [page, position]);
    return res.json({ success: true, items: rows });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
}

/** GET /search-store?q=...&bizNo=... (combined_store_info만) */
/** GET /search-store?q=...&bizNo=... (combined_store_info만) */
export async function searchStore(req, res) {
  try {
    const q = clean(req.query.q);
    const bizNo = digitsOnly(req.query.bizNo || req.query.businessNo || req.query.business_no);

    const params = [];
    let where = `WHERE 1=1`;

    if (q) {
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
      where += ` AND (
        business_name ILIKE $${params.length - 3}
        OR business_category ILIKE $${params.length - 2}
        OR business_type ILIKE $${params.length - 1}
        OR business_subcategory ILIKE $${params.length}
      )`;
    }

    if (bizNo) {
      params.push(`%${bizNo}%`);
      where += ` AND regexp_replace(COALESCE(business_number::text,''), '[^0-9]', '', 'g') ILIKE $${params.length}`;
    }

    const limit = (!q && !bizNo) ? 10 : 50;

    const sql = `
      SELECT
        id::text AS id,
        regexp_replace(COALESCE(business_number::text,''), '[^0-9]', '', 'g') AS business_no,
        business_name,
        business_type,
        business_category,
        business_subcategory,
        business_category AS category,
        COALESCE(NULLIF(main_image_url,''), '') AS image_url
      FROM ${STORE_TABLE}
      ${where}
      ORDER BY id DESC
      LIMIT ${limit}
    `;

    const { rows } = await pool.query(sql, params);

    // ✅ 배포/라우팅 확인용 버전 태그 (이게 안 보이면 너는 지금 예전 서버코드를 보고 있는 거임)
    return res.json({ success: true, version: "searchStore-v2-2025-12-24", stores: rows });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
}

/** POST /slot (multipart) */
export async function upsertSlot(req, res) {
  try {
    const page = clean(req.body.page) || "ncategory2";
    const position = clean(req.body.position);
    const priority = safeIntOrNull(req.body.priority);

    // ✅ slot_mode 기본값은 image가 안전
    const slot_mode = clean(req.body.slot_mode || req.body.slotMode) || "image";

    // ✅ DB 제약 대응: banner/text만 저장
    const raw_slot_type = clean(req.body.slot_type || req.body.slotType);
    const slot_type = normalizeSlotType(raw_slot_type, slot_mode);

    let store_type = clean(req.body.store_type || req.body.storeType);
    let table_source = clean(req.body.table_source || req.body.tableSource);
    let store_id = safeIntOrNull(req.body.store_id || req.body.storeId);
    let business_no = digitsOnly(req.body.business_no || req.body.businessNo);
    let business_name = clean(req.body.business_name || req.body.businessName);

    const text_content = clean(req.body.text_content || req.body.textContent);
    const link_url = clean(req.body.link_url || req.body.linkUrl);

    const clearImage = toBool(req.body.clearImage || req.body.clear_image);

    if (!position) return res.status(400).json({ success: false, error: "position required" });

    // ✅ store 모드인데 store_id 없으면 막기
    if (slot_mode === "store" && !store_id) {
      return res.status(400).json({ success: false, error: "store mode requires store_id" });
    }

    // ✅ store 모드가 아니면 가게 필드는 비움
    if (slot_mode !== "store") {
      store_type = "";
      table_source = "";
      store_id = null;
      business_no = "";
      business_name = "";
    }

    // ✅ 이미지 처리
    let image_url = clean(req.body.image_url || req.body.imageUrl);
    image_url = image_url ? image_url : null;

    const file = Array.isArray(req.files) && req.files.length ? req.files[0] : null;
    if (file?.filename) {
      image_url = `${UPLOAD_PUBLIC_PREFIX}/${file.filename}`;
    }

    if (clearImage) image_url = null;

    const sql = `
      INSERT INTO ${SLOTS_TABLE} (
        page, position, priority,
        slot_type, slot_mode,
        store_type, table_source,
        store_id, business_no, business_name,
        image_url, link_url, text_content,
        updated_at
      )
      VALUES (
        $1,$2,$3,
        $4,$5,
        $6,$7,
        $8,$9,$10,
        $11,$12,$13,
        NOW()
      )
      ON CONFLICT (page, position)
      DO UPDATE SET
        priority = EXCLUDED.priority,
        slot_type = EXCLUDED.slot_type,
        slot_mode = EXCLUDED.slot_mode,
        store_type = EXCLUDED.store_type,
        table_source = EXCLUDED.table_source,
        store_id = EXCLUDED.store_id,
        business_no = EXCLUDED.business_no,
        business_name = EXCLUDED.business_name,
        image_url = CASE
          WHEN $14 = true THEN NULL
          ELSE COALESCE(EXCLUDED.image_url, ${SLOTS_TABLE}.image_url)
        END,
        link_url = EXCLUDED.link_url,
        text_content = EXCLUDED.text_content,
        updated_at = NOW()
      RETURNING
        id, page, position, priority,
        slot_type, slot_mode,
        store_type, table_source,
        store_id, business_no, business_name,
        image_url, link_url, text_content,
        created_at, updated_at,
        start_date, end_date, no_end, start_at, end_at
    `;

    const values = [
      page, position, priority,
      slot_type, slot_mode,
      store_type || null, table_source || null,
      store_id, business_no || null, business_name || null,
      image_url, link_url || null, text_content || null,
      clearImage, // $14
    ];

    const { rows } = await pool.query(sql, values);
    return res.json({ success: true, slot: rows[0] || null });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
}

/** DELETE /slot?page=...&position=...&priority=... */
export async function deleteSlot(req, res) {
  try {
    const page = clean(req.query.page) || "ncategory2";
    const position = clean(req.query.position);
    const priority = safeIntOrNull(req.query.priority);

    if (!position) return res.status(400).json({ success: false, error: "position required" });

    const sql = `
      DELETE FROM ${SLOTS_TABLE}
      WHERE page = $1
        AND position = $2
        AND (priority IS NOT DISTINCT FROM $3)
    `;
    await pool.query(sql, [page, position, priority]);

    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
}
