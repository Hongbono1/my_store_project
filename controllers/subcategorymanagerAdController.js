import fs from "fs";
import path from "path";
import crypto from "crypto";
import pool from "../db.js";

// ✅ 업로드 경로(기존 매니저들과 동일 컨셉)
export const UPLOAD_SUBDIR = "manager_ad";
export const UPLOAD_ABS_DIR = path.join("/data/uploads", UPLOAD_SUBDIR);
export const UPLOAD_PUBLIC_PREFIX = `/uploads/${UPLOAD_SUBDIR}`;

// ✅ 슬롯 테이블(기존과 동일)
const SLOTS_TABLE = "public.admin_ad_slots";

// ✅ 통합/푸드 store 테이블 (검색/표시 JOIN용)
const STORE_TABLE_BY_MODE = {
  combined: "public.combined_store_info",
  food: "public.food_stores",
};

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
  const s = clean(v).toLowerCase();
  return s === "1" || s === "true" || s === "y" || s === "yes" || s === "on";
}

function normalizeMode(v) {
  const m = clean(v).toLowerCase();
  return m === "food" ? "food" : "combined";
}

function pickStoreTable(mode) {
  const m = normalizeMode(mode);
  return STORE_TABLE_BY_MODE[m] || STORE_TABLE_BY_MODE.combined;
}

function safeSlotKey(v) {
  // 슬롯 키는 파일/경로로 쓰지 않지만, 그래도 기본 sanitize
  return clean(v).replace(/[^a-zA-Z0-9_\-:.]/g, "");
}

function randomName(ext) {
  const id = crypto.randomUUID();
  return `${id}${ext || ""}`;
}

/**
 * multer storage helper
 */
export function makeMulterStorage() {
  ensureUploadDir();
  return {
    destination: function (_req, _file, cb) {
      ensureUploadDir();
      cb(null, UPLOAD_ABS_DIR);
    },
    filename: function (_req, file, cb) {
      const ext = path.extname(file.originalname || "").toLowerCase();
      cb(null, randomName(ext));
    },
  };
}

export function fileFilter(_req, file, cb) {
  const mime = clean(file.mimetype).toLowerCase();
  if (mime.startsWith("image/")) return cb(null, true);
  return cb(new Error("이미지 파일만 업로드 가능합니다."), false);
}

/**
 * ✅ (A) 슬롯/아이템 조회
 * - page, slot_key 기준으로 목록을 내려줌
 */
export async function getSlot(req, res) {
  const page = clean(req.query.page || "subcategory");
  const slot_key = safeSlotKey(req.query.slot_key);

  if (!slot_key) {
    return res.status(400).json({ success: false, error: "slot_key is required" });
  }

  try {
    const sql = `
      SELECT
        id,
        page,
        slot_key,
        slot_type,
        slot_mode,
        title,
        subtitle,
        image_url,
        link_url,
        store_id,
        start_date,
        end_date,
        no_end,
        priority,
        is_active,
        created_at,
        updated_at
      FROM ${SLOTS_TABLE}
      WHERE page = $1 AND slot_key = $2
      ORDER BY COALESCE(priority, 0) DESC, id DESC
    `;
    const { rows } = await pool.query(sql, [page, slot_key]);
    return res.json({ success: true, page, slot_key, items: rows });
  } catch (err) {
    console.error("❌ [subcategorymanagerAd] getSlot:", err?.message || err);
    return res.status(500).json({ success: false, error: err?.message || "server error" });
  }
}

export async function listSlots(req, res) {
  const page = clean(req.query.page || "subcategory");

  try {
    const sql = `
      SELECT
        id,
        page,
        slot_key,
        slot_type,
        slot_mode,
        title,
        subtitle,
        image_url,
        link_url,
        store_id,
        start_date,
        end_date,
        no_end,
        priority,
        is_active,
        created_at,
        updated_at
      FROM ${SLOTS_TABLE}
      WHERE page = $1
      ORDER BY slot_key ASC, COALESCE(priority, 0) DESC, id DESC
    `;
    const { rows } = await pool.query(sql, [page]);
    return res.json({ success: true, page, slots: rows });
  } catch (err) {
    console.error("❌ [subcategorymanagerAd] listSlots:", err?.message || err);
    return res.status(500).json({ success: false, error: err?.message || "server error" });
  }
}

// (옵션) 슬롯 아이템을 store 표시용으로 조인해서 주고 싶을 때
export async function listSlotItems(req, res) {
  const page = clean(req.query.page || "subcategory");
  const slot_key = safeSlotKey(req.query.slot_key);
  const mode = normalizeMode(req.query.mode); // combined|food
  const STORE_TABLE = pickStoreTable(mode);

  if (!slot_key) {
    return res.status(400).json({ success: false, error: "slot_key is required" });
  }

  try {
    // store_id가 숫자/문자 혼용일 수 있어 TEXT로 캐스팅 비교
    const sql = `
      SELECT
        s.id,
        s.page,
        s.slot_key,
        s.slot_type,
        s.slot_mode,
        s.title,
        s.subtitle,
        s.image_url,
        s.link_url,
        s.store_id,
        s.start_date,
        s.end_date,
        s.no_end,
        s.priority,
        s.is_active,
        s.created_at,
        s.updated_at,

        COALESCE(NULLIF(st.business_name,''), NULLIF(st.store_name,''), NULLIF(st.name,''), '') AS store_name,
        COALESCE(NULLIF(st.business_type,''), NULLIF(st.store_type,''), '') AS store_type
      FROM ${SLOTS_TABLE} s
      LEFT JOIN ${STORE_TABLE} st
        ON st.id::text = s.store_id::text
      WHERE s.page = $1 AND s.slot_key = $2
      ORDER BY COALESCE(s.priority, 0) DESC, s.id DESC
    `;
    const { rows } = await pool.query(sql, [page, slot_key]);
    return res.json({ success: true, page, slot_key, mode, items: rows });
  } catch (err) {
    console.error("❌ [subcategorymanagerAd] listSlotItems:", err?.message || err);
    return res.status(500).json({ success: false, error: err?.message || "server error" });
  }
}

/**
 * ✅ (B) 슬롯 저장(업서트)
 * - multipart/form-data 지원 (이미지 optional)
 * - body: id(optional), page, slot_key, slot_type, slot_mode, title, subtitle, link_url, store_id, start_date, end_date, no_end, priority, is_active
 * - 파일 필드명은 어떤 것이든 가능(upload.any()) — 첫 이미지 파일을 사용
 */
export async function upsertSlot(req, res) {
  const body = req.body || {};

  const id = safeIntOrNull(body.id);
  const page = clean(body.page || "subcategory");
  const slot_key = safeSlotKey(body.slot_key);

  const slot_type = clean(body.slot_type || "image"); // image|text 등
  const slot_mode = clean(body.slot_mode || "custom"); // store|custom 등
  const title = clean(body.title);
  const subtitle = clean(body.subtitle);
  const link_url = clean(body.link_url);

  const store_id = clean(body.store_id);
  const start_date = clean(body.start_date) || null; // 'YYYY-MM-DD' 권장
  const end_date = clean(body.end_date) || null;
  const no_end = toBool(body.no_end);
  const priority = safeIntOrNull(body.priority) ?? 0;
  const is_active = body.is_active === undefined ? true : toBool(body.is_active);

  if (!slot_key) {
    return res.status(400).json({ success: false, error: "slot_key is required" });
  }

  // ✅ 업로드된 이미지 처리(첫 이미지 파일 사용)
  let image_url = clean(body.image_url); // 기존 유지용
  try {
    const files = Array.isArray(req.files) ? req.files : [];
    const firstImg = files.find((f) => clean(f.mimetype).toLowerCase().startsWith("image/"));
    if (firstImg?.filename) {
      image_url = `${UPLOAD_PUBLIC_PREFIX}/${firstImg.filename}`;
    }
  } catch (_e) {}

  try {
    if (id) {
      const sql = `
        UPDATE ${SLOTS_TABLE}
        SET
          page = $1,
          slot_key = $2,
          slot_type = $3,
          slot_mode = $4,
          title = $5,
          subtitle = $6,
          image_url = $7,
          link_url = $8,
          store_id = $9,
          start_date = $10,
          end_date = $11,
          no_end = $12,
          priority = $13,
          is_active = $14,
          updated_at = NOW()
        WHERE id = $15
        RETURNING *
      `;
      const params = [
        page,
        slot_key,
        slot_type,
        slot_mode,
        title,
        subtitle,
        image_url,
        link_url,
        store_id || null,
        start_date,
        end_date,
        no_end,
        priority,
        is_active,
        id,
      ];
      const { rows } = await pool.query(sql, params);
      return res.json({ success: true, action: "updated", slot: rows[0] || null });
    }

    const sql = `
      INSERT INTO ${SLOTS_TABLE}
        (page, slot_key, slot_type, slot_mode, title, subtitle, image_url, link_url, store_id, start_date, end_date, no_end, priority, is_active, created_at, updated_at)
      VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW(),NOW())
      RETURNING *
    `;
    const params = [
      page,
      slot_key,
      slot_type,
      slot_mode,
      title,
      subtitle,
      image_url,
      link_url,
      store_id || null,
      start_date,
      end_date,
      no_end,
      priority,
      is_active,
    ];
    const { rows } = await pool.query(sql, params);
    return res.json({ success: true, action: "inserted", slot: rows[0] || null });
  } catch (err) {
    console.error("❌ [subcategorymanagerAd] upsertSlot:", err?.message || err);
    return res.status(500).json({ success: false, error: err?.message || "server error" });
  }
}

/**
 * ✅ (C) 삭제
 */
export async function deleteSlot(req, res) {
  const id = safeIntOrNull(req.query.id || req.body?.id);
  if (!id) return res.status(400).json({ success: false, error: "id is required" });

  try {
    const sql = `DELETE FROM ${SLOTS_TABLE} WHERE id = $1 RETURNING id`;
    const { rows } = await pool.query(sql, [id]);
    return res.json({ success: true, deleted: rows[0] || null });
  } catch (err) {
    console.error("❌ [subcategorymanagerAd] deleteSlot:", err?.message || err);
    return res.status(500).json({ success: false, error: err?.message || "server error" });
  }
}

/**
 * ✅ (D) 모달 가게 검색 (통합/푸드 모드)
 * - q=__all__ 전체(상위 N개)
 * - q=텍스트: 상호/업종/카테고리/서브카테고리 LIKE
 * - q=숫자: 사업자번호 digitsOnly 매칭도 시도
 */
export async function searchStore(req, res) {
  const q = clean(req.query.q);
  const mode = normalizeMode(req.query.mode); // combined|food
  const STORE_TABLE = pickStoreTable(mode);

  try {
    const digits = digitsOnly(q);

    let sql = `
      SELECT
        id::text AS id,
        COALESCE(NULLIF(business_number,''), NULLIF(business_no,''), '') AS business_no,
        COALESCE(NULLIF(business_name,''), NULLIF(store_name,''), NULLIF(name,''), '') AS business_name,
        COALESCE(NULLIF(business_type,''), NULLIF(store_type,''), '') AS business_type,
        COALESCE(NULLIF(business_category,''), NULLIF(category,''), '') AS business_category,
        COALESCE(NULLIF(business_subcategory,''), NULLIF(subcategory,''), NULLIF(business_sub_cat,''), '') AS business_subcategory,
        COALESCE(NULLIF(image_url,''), NULLIF(main_image_url,''), '') AS image_url
      FROM ${STORE_TABLE}
    `;

    const params = [];
    if (q === "__all__" || q === "") {
      sql += ` ORDER BY id DESC LIMIT 50`;
      const { rows } = await pool.query(sql, params);
      return res.json({ success: true, mode, version: "searchStore-v1-subcategorymanager", stores: rows });
    }

    sql += `
      WHERE
        (
          COALESCE(NULLIF(business_name,''), NULLIF(store_name,''), NULLIF(name,''), '') ILIKE $1
          OR COALESCE(NULLIF(business_type,''), NULLIF(store_type,''), '') ILIKE $1
          OR COALESCE(NULLIF(business_category,''), NULLIF(category,''), '') ILIKE $1
          OR COALESCE(NULLIF(business_subcategory,''), NULLIF(subcategory,''), NULLIF(business_sub_cat,''), '') ILIKE $1
        )
    `;
    params.push(`%${q}%`);

    if (digits) {
      sql += `
        OR REPLACE(COALESCE(NULLIF(business_number,''), NULLIF(business_no,''), ''), '-', '') LIKE $2
      `;
      params.push(`%${digits}%`);
    }

    sql += ` ORDER BY id DESC LIMIT 50`;

    const { rows } = await pool.query(sql, params);
    return res.json({ success: true, mode, version: "searchStore-v1-subcategorymanager", stores: rows });
  } catch (err) {
    console.error("❌ [subcategorymanagerAd] searchStore:", err?.message || err);
    return res.status(500).json({ success: false, error: err?.message || "server error" });
  }
}
