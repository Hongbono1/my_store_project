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

    // ✅ admin_ad_slots 실제 컬럼만 + 표시용 업종은 JOIN 결과로만 제공
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

    const slot_type = clean(req.body.slot_type || req.body.slotType) || "image";
    const slot_mode = clean(req.body.slot_mode || req.body.slotMode) || "store";

    let store_type = clean(req.body.store_type || req.body.storeType);
    let table_source = clean(req.body.table_source || req.body.tableSource);
    let store_id = safeIntOrNull(req.body.store_id || req.body.storeId);
    let business_no = digitsOnly(req.body.business_no || req.body.businessNo);
    let business_name = clean(req.body.business_name || req.body.businessName);

    const text_content = clean(req.body.text_content || req.body.textContent);
    const link_url = clean(req.body.link_url || req.body.linkUrl);

    const keepImage = toBool(req.body.keepImage || req.body.keep_image);
    const clearImage = toBool(req.body.clearImage || req.body.clear_image);

    if (!position) return res.status(400).json({ success: false, error: "position required" });

    // ✅ store 모드인데 store_id 없으면 막기
    if (slot_mode === "store" && !store_id) {
      return res.status(400).json({ success: false, error: "store mode requires store_id" });
    }

    // ✅ banner 모드면 가게 연결 필드는 비움
    if (slot_mode !== "store") {
      store_type = "";
      table_source = "";
      store_id = null;
      business_no = "";
      business_name = "";
    }

    // ✅ 이미지 처리 (clear 우선)
    let image_url = clean(req.body.image_url || req.body.imageUrl);
    image_url = image_url ? image_url : null;

    const file = Array.isArray(req.files) && req.files.length ? req.files[0] : null;
    if (file?.filename) {
      image_url = `${UPLOAD_PUBLIC_PREFIX}/${file.filename}`;
    }

    // clear 체크면 무조건 null
    if (clearImage) {
      image_url = null;
    }

    // ✅ upsert
    // - UNIQUE가 (page, position) 이라는 전제로 유지
    // - priority를 쓰고 싶으면 UNIQUE/ON CONFLICT도 (page, position, priority)로 맞춰야 함
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

        -- ✅ 이미지 규칙:
        -- clearImage=true면 NULL
        -- 아니면 새 값이 있으면 새 값, 없으면 기존 유지
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
