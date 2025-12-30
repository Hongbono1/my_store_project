import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import pool from "../db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const UPLOAD_SUBDIR = "manager_ad";

// ✅ /data/uploads가 있으면 무조건 그쪽을 우선 사용 (NODE_ENV 의존 제거)
const PERSIST_ROOT = process.env.UPLOAD_ROOT || "/data/uploads";
const hasPersistentRoot = fs.existsSync(PERSIST_ROOT);

export const UPLOAD_ABS_DIR = hasPersistentRoot
  ? path.join(PERSIST_ROOT, UPLOAD_SUBDIR)
  : path.join(__dirname, "..", "public2", "uploads", UPLOAD_SUBDIR);

export const UPLOAD_PUBLIC_PREFIX = `/uploads/${UPLOAD_SUBDIR}`;

const SLOTS_TABLE = "public.admin_ad_slots";

// ✅ ncategory2는 combined_store_info 기준
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

// ✅ 이미지 URL을 브라우저에서 열리는 형태로 통일
function toPublicImageUrl(v) {
  const s = clean(v);
  if (!s) return "";

  if (/^https?:\/\//i.test(s)) return s;

  if (s.startsWith("/data/uploads/")) {
    return s.replace("/data/uploads/", "/uploads/");
  }

  if (s.startsWith("/uploads/")) return s;
  if (s.startsWith("uploads/")) return `/${s}`;

  return `/uploads/${s.replace(/^\/+/, "")}`;
}

// ✅ DB 체크 제약: slot_type 은 banner/text만 허용
function normalizeSlotType(slot_type, slot_mode) {
  const st = clean(slot_type).toLowerCase();
  const sm = clean(slot_mode).toLowerCase();

  if (st === "image") return "banner";
  if (st === "banner" || st === "text") return st;

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

/** ✅ GET /category-tree : ncategory2 사이드바 카테고리 트리 (DB에서 바로 생성) */
export async function getCategoryTree(req, res) {
  try {
    const sql = `
      SELECT
        NULLIF(TRIM(business_category), '') AS category,
        NULLIF(TRIM(detail_category), '') AS subcategory
      FROM ${STORE_TABLE}
      WHERE COALESCE(TRIM(business_category), '') <> ''
      GROUP BY 1,2
      ORDER BY 1 ASC, 2 ASC
    `;
    const { rows } = await pool.query(sql);

    const map = new Map();
    for (const r of rows) {
      const cat = clean(r.category);
      if (!cat) continue;
      if (!map.has(cat)) map.set(cat, new Set());
      const sub = clean(r.subcategory);
      if (sub) map.get(cat).add(sub);
    }

    const tree = [...map.entries()]
      .map(([category, set]) => ({
        category,
        subcategories: [...set].sort((a, b) => a.localeCompare(b, "ko")),
      }))
      .sort((a, b) => a.category.localeCompare(b.category, "ko"));

    return res.json({ ok: true, success: true, tree });
  } catch (e) {
    console.error("❌ [ncategory2/category-tree] error:", e);
    return res.status(500).json({ ok: false, success: false, error: e.message || "server error" });
  }
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
    rows.forEach(r => {
      r.image_url = toPublicImageUrl(r.image_url);
    });
    return res.json({ ok: true, success: true, slots: rows });
  } catch (e) {
    return res.status(500).json({ ok: false, success: false, error: e.message });
  }
}

/** GET /slot?page=...&position=...&priority=... */
export async function getSlot(req, res) {
  try {
    const page = clean(req.query.page) || "ncategory2";
    const position = clean(req.query.position);
    const priority = safeIntOrNull(req.query.priority);

    if (!position) return res.json({ ok: true, success: true, slot: null });

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
        AND ($3::int IS NULL OR s.priority IS NOT DISTINCT FROM $3)
      ORDER BY s.position ASC, s.priority ASC NULLS FIRST
      LIMIT 1
    `;

    const { rows } = await pool.query(sql, [page, position, priority]);
    const slot = rows[0] || null;
    if (slot) {
      slot.image_url = toPublicImageUrl(slot.image_url);
    }
    return res.json({ ok: true, success: true, slot });
  } catch (e) {
    return res.status(500).json({ ok: false, success: false, error: e.message });
  }
}

/** ✅ GET /slot-items?page=...&position=... */
export async function listSlotItems(req, res) {
  try {
    const page = clean(req.query.page) || "ncategory2";
    const position = clean(req.query.position);

    let sql, params;

    if (!position) {
      sql = `
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
        ORDER BY s.position ASC, s.priority ASC NULLS FIRST, s.updated_at DESC
        LIMIT 100
      `;
      params = [page];
    } else {
      sql = `
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
      params = [page, position];
    }

    const { rows } = await pool.query(sql, params);
    rows.forEach(r => {
      r.image_url = toPublicImageUrl(r.image_url);
    });
    return res.json({ ok: true, success: true, items: rows });
  } catch (e) {
    return res.status(500).json({ ok: false, success: false, error: e.message });
  }
}

// -------------------- ✅ GET /ncategory2manager/ad/search-store --------------------
// ✅ ncategory2manager는 combined_store_info 조회 + q=__all__ 전체조회 지원
export async function searchStore(req, res) {
  try {
    const qRaw = clean(req.query.q);
    const q = (qRaw === "__all__") ? "" : qRaw;

    const bizNo = digitsOnly(req.query.bizNo);

    const params = [];
    const cond = [];

    if (bizNo) {
      params.push(bizNo);
      const idx = params.length;
      cond.push(`regexp_replace(COALESCE(s.business_number::text,''), '[^0-9]', '', 'g') = $${idx}`);
    }

    if (q) {
      params.push(`%${q}%`);
      const idx = params.length;
      cond.push(`
        (
          s.business_name ILIKE $${idx}
          OR COALESCE(s.business_number::text,'') ILIKE $${idx}
          OR COALESCE(s.business_type,'') ILIKE $${idx}
          OR COALESCE(s.business_category,'') ILIKE $${idx}
          OR COALESCE(s.detail_category,'') ILIKE $${idx}
        )
      `);
    }

    const where = cond.length ? `WHERE ${cond.join(" AND ")}` : "";

    const sql = `
      SELECT
        s.id::text AS id,
        'combined_store_info' AS table_source,
        regexp_replace(COALESCE(s.business_number::text,''), '[^0-9]', '', 'g') AS business_no,
        COALESCE(s.business_name, '') AS business_name,
        COALESCE(s.business_type, '') AS business_type,
        COALESCE(s.business_category, '') AS business_category,
        COALESCE(s.detail_category, '') AS business_subcategory,
        COALESCE(s.business_category, '') AS category,
        COALESCE(s.main_image_url, '') AS image_url
      FROM ${STORE_TABLE} s
      ${where}
      ORDER BY s.id DESC
      LIMIT 2000;
    `;

    const { rows } = await pool.query(sql, params);
    (rows || []).forEach(r => {
      r.image_url = toPublicImageUrl(r.image_url);
    });

    return res.json({
      ok: true,
      success: true,
      version: "ncategory2-search-store-combined_store_info",
      stores: rows || []
    });
  } catch (e) {
    console.error("❌ [ncategory2manager/search-store] error:", e);
    return res.status(500).json({ ok: false, success: false, error: e.message || "server error" });
  }
}

/** POST /slot (multipart) */
export async function upsertSlot(req, res) {
  try {
    const page = clean(req.body.page) || "ncategory2";
    const position = clean(req.body.position);
    const priority = safeIntOrNull(req.body.priority);

    const slot_mode = clean(req.body.slot_mode || req.body.slotMode) || "image";

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

    if (!position) return res.status(400).json({ ok: false, success: false, error: "position required" });

    if (slot_mode === "store" && !store_id) {
      return res.status(400).json({ ok: false, success: false, error: "store mode requires store_id" });
    }

    if (slot_mode !== "store") {
      store_type = "";
      table_source = "";
      store_id = null;
      business_no = "";
      business_name = "";
    }

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
      clearImage,
    ];

    const { rows } = await pool.query(sql, values);
    return res.json({ ok: true, success: true, slot: rows[0] || null });
  } catch (e) {
    return res.status(500).json({ ok: false, success: false, error: e.message });
  }
}

/** DELETE /slot?page=...&position=...&priority=... */
export async function deleteSlot(req, res) {
  try {
    const page = clean(req.query.page) || "ncategory2";
    const position = clean(req.query.position);
    const priority = safeIntOrNull(req.query.priority);

    if (!position) return res.status(400).json({ ok: false, success: false, error: "position required" });

    const sql = `
      DELETE FROM ${SLOTS_TABLE}
      WHERE page = $1
        AND position = $2
        AND (priority IS NOT DISTINCT FROM $3)
    `;
    await pool.query(sql, [page, position, priority]);

    return res.json({ ok: true, success: true });
  } catch (e) {
    return res.status(500).json({ ok: false, success: false, error: e.message });
  }
}
