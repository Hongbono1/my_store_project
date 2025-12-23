import fs from "fs";
import path from "path";
import crypto from "crypto";
import pool from "../db.js";

export const UPLOAD_SUBDIR = "manager_ad";
export const UPLOAD_ABS_DIR = path.join("/data/uploads", UPLOAD_SUBDIR);
export const UPLOAD_PUBLIC_PREFIX = `/uploads/${UPLOAD_SUBDIR}`;

// ✅ 테이블(푸드 매니저와 동일하게 쓰는 전제)
// - 컬럼명이 다르면 여기 SQL의 컬럼만 Neon에 맞게 바꾸면 됨.
const SLOTS_TABLE = "public.admin_ad_slots";

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

function safeInt(v) {
  const n = Number(String(v ?? "").replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function nowIso() {
  return new Date().toISOString();
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

/** GET /slots */
export async function listSlots(req, res) {
  try {
    // page='ncategory2' 기준으로 불러오되,
    // 테이블에 page 컬럼이 없으면 WHERE 절을 제거해서 쓰면 됨.
    const sql = `
      SELECT
        position,
        page,
        slot_type,
        slot_mode,
        store_type,
        store_id,
        business_no,
        business_name,
        category,
        image_url,
        text_content,
        link_url,
        updated_at
      FROM ${SLOTS_TABLE}
      WHERE page = 'ncategory2'
      ORDER BY position ASC
    `;
    const { rows } = await pool.query(sql);
    return res.json({ success: true, slots: rows });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
}

/** GET /slot?position=... */
export async function getSlot(req, res) {
  try {
    const position = clean(req.query.position);
    if (!position) return res.json({ success: true, slot: null });

    const sql = `
      SELECT
        position,
        page,
        slot_type,
        slot_mode,
        store_type,
        store_id,
        business_no,
        business_name,
        category,
        image_url,
        text_content,
        link_url,
        updated_at
      FROM ${SLOTS_TABLE}
      WHERE page = 'ncategory2' AND position = $1
      LIMIT 1
    `;
    const { rows } = await pool.query(sql, [position]);
    return res.json({ success: true, slot: rows[0] || null });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
}

/** GET /search-store?q=...&bizNo=...  (combined_store_info만) */
export async function searchStore(req, res) {
  try {
    const q = clean(req.query.q);
    const bizNo = digitsOnly(req.query.bizNo);

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
      FROM public.combined_store_info
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
    const position = clean(req.body.position);
    const page = clean(req.body.page) || "ncategory2";
    const slot_type = clean(req.body.slot_type) || "image";
    const slot_mode = clean(req.body.slot_mode) || "store";

    const store_type = clean(req.body.store_type);
    const store_id = clean(req.body.store_id);
    const business_no = digitsOnly(req.body.business_no);
    const business_name = clean(req.body.business_name);
    const category = clean(req.body.category);
    const text_content = clean(req.body.text_content);
    const link_url = clean(req.body.link_url);

    if (!position) return res.status(400).json({ success: false, error: "position required" });

    // ✅ 이미지 파일 있으면 반영
    let image_url = clean(req.body.image_url);
    const file = Array.isArray(req.files) && req.files.length ? req.files[0] : null;
    if (file?.filename) {
      image_url = `${UPLOAD_PUBLIC_PREFIX}/${file.filename}`;
    }

    // ✅ store 모드인데 store_id 없으면 막기
    if (slot_mode === "store" && !store_id) {
      return res.status(400).json({ success: false, error: "store mode requires store_id" });
    }

    // ✅ admin_ad_slots 에 upsert
    // - 테이블 PK/UNIQUE가 (page, position) 이면 ON CONFLICT (page, position)
    // - position 단독이면 ON CONFLICT (position) 로 바꾸면 됨
    const sql = `
      INSERT INTO ${SLOTS_TABLE} (
        page, position,
        slot_type, slot_mode,
        store_type, store_id,
        business_no, business_name, category,
        image_url, text_content, link_url,
        updated_at
      )
      VALUES (
        $1,$2,
        $3,$4,
        $5,$6,
        $7,$8,$9,
        $10,$11,$12,
        NOW()
      )
      ON CONFLICT (page, position)
      DO UPDATE SET
        slot_type = EXCLUDED.slot_type,
        slot_mode = EXCLUDED.slot_mode,
        store_type = EXCLUDED.store_type,
        store_id = EXCLUDED.store_id,
        business_no = EXCLUDED.business_no,
        business_name = EXCLUDED.business_name,
        category = EXCLUDED.category,
        image_url = COALESCE(EXCLUDED.image_url, ${SLOTS_TABLE}.image_url),
        text_content = EXCLUDED.text_content,
        link_url = EXCLUDED.link_url,
        updated_at = NOW()
      RETURNING
        position, page, slot_type, slot_mode,
        store_type, store_id, business_no, business_name, category,
        image_url, text_content, link_url, updated_at
    `;

    const values = [
      page, position,
      slot_type, slot_mode,
      store_type || null, store_id || null,
      business_no || null, business_name || null, category || null,
      image_url || null, text_content || null, link_url || null
    ];

    const { rows } = await pool.query(sql, values);
    return res.json({ success: true, slot: rows[0] || null });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
}

/** DELETE /slot?position=... */
export async function deleteSlot(req, res) {
  try {
    const position = clean(req.query.position);
    if (!position) return res.status(400).json({ success: false, error: "position required" });

    // page 조건 포함 (page 컬럼 없으면 제거)
    const sql = `DELETE FROM ${SLOTS_TABLE} WHERE page='ncategory2' AND position=$1`;
    await pool.query(sql, [position]);

    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
}
