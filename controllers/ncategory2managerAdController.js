// controllers/ncategory2managerAdController.js
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

/** ✅ slot_type은 DB 제약: banner | text 만 */
function normalizeSlotType(slotMode, slotTypeRaw) {
  const t = clean(slotTypeRaw).toLowerCase();
  if (t === "banner" || t === "text") return t;
  // UI slotMode 기준으로 강제 결정
  return clean(slotMode).toLowerCase() === "text" ? "text" : "banner";
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
        s.image_url,
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
        ON s.table_source = 'combined_store_info'
       AND c.id = s.store_id
      WHERE s.page = $1
      ORDER BY s.position ASC, s.priority ASC NULLS FIRST
    `;

    const { rows } = await pool.query(sql, [page]);
    return res.json({ success: true, slots: rows });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
}

/** ✅ GET /slot-items?page=...&position=...  (404 없애고 후보목록 제공) */
export async function listSlotItems(req, res) {
  try {
    const page = clean(req.query.page) || "ncategory2";
    const position = clean(req.query.position);

    if (!position) return res.json({ success: true, items: [] });

    // 현재 테이블이 admin_ad_slots 하나라면, "후보"는 결국 이 테이블의 rows.
    // (UNIQUE가 (page, position) 이면 사실상 1개만 나오지만, 404 방지 + UI용 응답은 가능)
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
        s.image_url,
        s.link_url,
        s.text_content,
        s.created_at,
        s.updated_at,
        s.start_at,
        s.end_at,
        s.no_end,
        s.store_type,
        s.table_source,
        COALESCE(c.business_category, '') AS business_category
      FROM ${SLOTS_TABLE} s
      LEFT JOIN ${STORE_TABLE} c
        ON s.table_source = 'combined_store_info'
       AND c.id = s.store_id
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
        s.business_no,
        s.business_name,
        s.image_url,
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
        ON s.table_source = 'combined_store_info'
       AND c.id = s.store_id
      WHERE s.page = $1
        AND s.position = $2
        AND (s.priority IS NOT DISTINCT FROM $3)
      LIMIT 1
    `;

    const { rows } = await pool.query(sql, [page, position, priority]);
    return res.json({ success: true, slot: rows[0] || null });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
}

/** GET /store/search?q=...&bizNo=... (combined_store_info만) */
export async function searchStore(req, res) {
  try {
    const q = clean(req.query.q);
    const bizNo = digitsOnly(req.query.bizNo || req.query.businessNo || req.query.business_no);

    const params = [];
    let where = `WHERE 1=1`;

    if (q) {
      params.push(`%${q}%`);
      params.push(`%${q}%`);
      where += ` AND (business_name ILIKE $${params.length - 1} OR business_category ILIKE $${params.length})`;
    }

    if (bizNo) {
      params.push(`%${bizNo}%`);
      where += ` AND regexp_replace(COALESCE(business_number::text,''), '[^0-9]', '', 'g') ILIKE $${params.length}`;
    }

    const sql = `
      SELECT
        id::text AS id,
        regexp_replace(COALESCE(business_number::text,''), '[^0-9]', '', 'g') AS business_no,
        business_name,
        business_category AS category
      FROM ${STORE_TABLE}
      ${where}
      ORDER BY id DESC
      LIMIT 50
    `;

    const { rows } = await pool.query(sql, params);
    return res.json({ success: true, stores: rows });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
}

/** POST /slot (multipart) */
export async function upsertSlot(req, res) {
  try {
    const page = clean(req.body.page) || "ncategory2";
    const position = clean(req.body.position);
    const priority = safeIntOrNull(req.body.priority); // "" -> null

    // ✅ slot_mode 기본값은 image (store로 기본 잡히면 store_id 때문에 400 터짐)
    const slot_mode = clean(req.body.slot_mode || req.body.slotMode) || "image";

    // ✅ slot_type은 banner/text만 허용 → 강제 보정
    const slot_type = normalizeSlotType(slot_mode, req.body.slot_type || req.body.slotType);

    let store_type = clean(req.body.store_type || req.body.storeType);
    let table_source = clean(req.body.table_source || req.body.tableSource);
    let store_id = safeIntOrNull(req.body.store_id || req.body.storeId);
    let business_no = digitsOnly(req.body.business_no || req.body.businessNo);
    let business_name = clean(req.body.business_name || req.body.businessName);

    const text_content = clean(req.body.text_content || req.body.textContent);
    const link_url = clean(req.body.link_url || req.body.linkUrl);

    const clearImage = toBool(req.body.clearImage || req.body.clear_image);

    // 기간(모달에서 보내는 값 받아둠) - DB 컬럼 존재하니 저장
    const start_at = clean(req.body.start_at || req.body.startAt) || null;
    const end_at = clean(req.body.end_at || req.body.endAt) || null;
    const no_end = toBool(req.body.no_end || req.body.noEnd);

    if (!position) return res.status(400).json({ success: false, error: "position required" });

    // ✅ store 모드인데 store_id 없으면 막기
    if (slot_mode === "store" && !store_id) {
      return res.status(400).json({ success: false, error: "store mode requires store_id" });
    }

    // ✅ store 모드가 아니면 가게 연결 필드 비움
    if (slot_mode !== "store") {
      store_type = "";
      table_source = "";
      store_id = null;
      business_no = "";
      business_name = "";
    }

    // ✅ text 모드면 이미지도 의미 없음 → 강제로 제거(원하면 유지로 바꿔도 됨)
    // (지금 UX는 텍스트 전용이라 이미지/가게/링크 숨김이라 null이 더 안전)
    let image_url = clean(req.body.image_url || req.body.imageUrl);
    image_url = image_url ? image_url : null;

    const file = Array.isArray(req.files) && req.files.length ? req.files[0] : null;
    if (file?.filename) {
      image_url = `${UPLOAD_PUBLIC_PREFIX}/${file.filename}`;
    }

    if (clearImage || slot_mode === "text") {
      image_url = null;
    }

    const sql = `
      INSERT INTO ${SLOTS_TABLE} (
        page, position, priority,
        slot_type, slot_mode,
        store_type, table_source,
        store_id, business_no, business_name,
        image_url, link_url, text_content,
        start_at, end_at, no_end,
        updated_at
      )
      VALUES (
        $1,$2,$3,
        $4,$5,
        $6,$7,
        $8,$9,$10,
        $11,$12,$13,
        $14,$15,$16,
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
        image_url = EXCLUDED.image_url,
        link_url = EXCLUDED.link_url,
        text_content = EXCLUDED.text_content,
        start_at = EXCLUDED.start_at,
        end_at = EXCLUDED.end_at,
        no_end = EXCLUDED.no_end,
        updated_at = NOW()
      RETURNING
        id, page, position, priority,
        slot_type, slot_mode,
        store_type, table_source,
        store_id, business_no, business_name,
        image_url, link_url, text_content,
        created_at, updated_at,
        start_at, end_at, no_end
    `;

    const values = [
      page, position, priority,
      slot_type, slot_mode,
      store_type || null, table_source || null,
      store_id, business_no || null, business_name || null,
      image_url, link_url || null, text_content || null,
      start_at, end_at, no_end,
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
