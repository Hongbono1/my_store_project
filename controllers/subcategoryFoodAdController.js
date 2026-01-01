// controllers/subcategoryFoodAdController.js
import fs from "fs";
import path from "path";
import crypto from "crypto";
import pool from "../db.js";

/**
 * ----------------------------------------------------------
 *  Subcategory Manager (FOOD) - Controller (Full)
 *  - Upload dir: /data/uploads/manager_ad
 *  - Slot table: public.admin_ad_slots
 *  - Food stores: public.store_info
 *  - Food images: public.store_images (url)  ✅ 확정
 *    - join: store_images.store_id = store_info.id
 *    - order: sort_order ASC, id ASC  (첫 번째가 메인)
 * ----------------------------------------------------------
 */

// 업로드 경로(다른 매니저와 동일)
export const UPLOAD_SUBDIR = "manager_ad";
export const UPLOAD_ABS_DIR = path.join("/data/uploads", UPLOAD_SUBDIR);
export const UPLOAD_PUBLIC_PREFIX = `/uploads/${UPLOAD_SUBDIR}`;

// 슬롯 테이블(기존 재사용)
const SLOTS_TABLE = "public.admin_ad_slots";

// ✅ FOOD 가게 테이블
const FOOD_TABLE = "public.store_info";

// ✅ FOOD 이미지 테이블(확정): store_images.url
const FOOD_IMAGE_TABLE = "public.store_images";

// 페이지 고정(서브카테고리)
const PAGE_NAME = "subcategory";

/** ----------------- util ----------------- */
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

function safeInt(v, fallback = 0) {
  const n = parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n, min, max) {
  return Math.min(Math.max(n, min), max);
}

function toBool(v) {
  const s = clean(v).toLowerCase();
  return s === "1" || s === "true" || s === "y" || s === "yes" || s === "on";
}

function safeDateOrNull(v) {
  const s = clean(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function keyPart(v) {
  return clean(v).replaceAll("|", "/");
}

// DB 제약: slot_type IN ('banner','text')
function mapSlotType(adMode) {
  const m = clean(adMode).toLowerCase();
  if (m === "text") return "text";
  return "banner";
}

/**
 * ✅ 핵심 규칙(요구사항 반영)
 * - 한식만 subcategory(detail_category) 사용
 * - 그 외 카테고리는 subcategory 무조건 무시("")
 */
function normalizeCategorySub(category, subcategory) {
  const cat = clean(category);
  let sub = clean(subcategory);

  const isHansik = cat === "한식";
  if (!isHansik) sub = "";

  // category 자체가 없으면 subcategory도 의미 없으니 제거
  if (!cat) sub = "";

  return { category: cat, subcategory: sub, isHansik };
}

/**
 * position 규칙(FOOD)
 * subcategory|food|{category}|{subcategory}|{section}|{idx}
 */
function buildPosition({ mode = "food", category = "", subcategory = "", section = "", idx = 1 }) {
  const sec = clean(section);

  // ✅ top 배너는 전체 공통 1장: category/subcategory 무조건 무시
  if (sec === "top") {
    category = "";
    subcategory = "";
  } else {
    // ✅ 한식만 subcategory 유지(기존 규칙 유지)
    const norm = normalizeCategorySub(category, subcategory);
    category = norm.category;
    subcategory = norm.subcategory;
  }

  return [
    PAGE_NAME,
    keyPart(mode || "food"),
    keyPart(category),
    keyPart(subcategory),
    keyPart(sec),
    String(idx),
  ].join("|");
}

/** ----------------- multer helpers ----------------- */
export function fileFilter(_req, file, cb) {
  const ok = !!file?.mimetype?.startsWith("image/");
  if (!ok) return cb(new Error("Only image files are allowed"), false);
  return cb(null, true);
}

export function makeMulterStorage() {
  ensureUploadDir();

  return {
    destination: (_req, _file, cb) => {
      ensureUploadDir();
      cb(null, UPLOAD_ABS_DIR);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
      const name = `${
        crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex")
      }${ext}`;
      cb(null, name);
    },
  };
}

/** ----------------- schema introspection (slots) ----------------- */
let _slotsColsCache = null;
async function getSlotsColumns() {
  if (_slotsColsCache) return _slotsColsCache;

  const sql = `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = $1 AND table_name = $2
  `;
  const [schema, table] = SLOTS_TABLE.split(".");
  const { rows } = await pool.query(sql, [
    schema.replaceAll('"', ""),
    table.replaceAll('"', ""),
  ]);
  _slotsColsCache = new Set(rows.map((r) => r.column_name));
  return _slotsColsCache;
}

function hasCol(cols, name) {
  return cols && cols.has(name);
}

/** ----------------- store_info 컬럼 (네 DB 기준) ----------------- */
const STORE_MAP = {
  id: "id",
  businessNo: "business_number",
  businessName: "business_name",
  businessType: "business_type",
  category: "business_category",
  subcategory: "detail_category", // ✅ store_info는 detail_category가 서브카테고리
};

/** ----------------- image join (store_images.url) ----------------- */
let _storeImagesReadyCache = null;
async function ensureStoreImagesReady() {
  if (_storeImagesReadyCache !== null) return _storeImagesReadyCache;

  // 테이블 존재 확인
  const { rows: r0 } = await pool.query("SELECT to_regclass($1) AS reg", [
    FOOD_IMAGE_TABLE,
  ]);
  if (!r0?.[0]?.reg) {
    _storeImagesReadyCache = false;
    return false;
  }

  // 컬럼 확인(url, store_id 필수)
  const [schema, table] = FOOD_IMAGE_TABLE.split(".");
  const { rows } = await pool.query(
    `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = $1 AND table_name = $2
  `,
    [schema, table]
  );

  const cols = new Set(rows.map((x) => x.column_name));
  const ok = cols.has("store_id") && cols.has("url");
  _storeImagesReadyCache = ok;
  return ok;
}

function normalizeImageUrl(u) {
  const s = clean(u);
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("/")) return s;
  return `/${s}`;
}

/** ----------------- SLOT helpers ----------------- */
function safePublicImageUrl(file) {
  if (!file?.filename) return "";
  return `${UPLOAD_PUBLIC_PREFIX}/${file.filename}`;
}

function safeUnlinkIfMine(imageUrl) {
  try {
    const url = String(imageUrl || "");
    if (!url.startsWith(UPLOAD_PUBLIC_PREFIX + "/")) return;
    const filename = url.replace(UPLOAD_PUBLIC_PREFIX + "/", "");
    if (!filename) return;
    const abs = path.join(UPLOAD_ABS_DIR, filename);
    if (abs.startsWith(UPLOAD_ABS_DIR) && fs.existsSync(abs)) fs.unlinkSync(abs);
  } catch {
    // ignore
  }
}

/** ----------------- Store Info Hydration Helpers ----------------- */
async function fetchStoreMapByIdsOrBiz(storeIds, bizNos) {
  const ids = Array.from(new Set((storeIds || []).map((x) => String(x)).filter(Boolean)));
  const biz = Array.from(new Set((bizNos || []).map((x) => String(x).replace(/[^\d]/g, "")).filter(Boolean)));

  if (!ids.length && !biz.length) return { byId: new Map(), byBiz: new Map() };

  const hasStoreImages = await ensureStoreImagesReady();
  const imgSelectSql = hasStoreImages ? `, COALESCE(img.url, '') AS image_url` : `, '' AS image_url`;
  const imgJoinSql = hasStoreImages
    ? `
      LEFT JOIN LATERAL (
        SELECT i.url
        FROM ${FOOD_IMAGE_TABLE} i
        WHERE i.store_id = s.${STORE_MAP.id}
        ORDER BY i.sort_order ASC NULLS LAST, i.id ASC
        LIMIT 1
      ) img ON true
    `
    : "";

  const conds = [];
  const params = [];
  let i = 1;

  if (ids.length) {
    conds.push(`s.${STORE_MAP.id}::text = ANY($${i++}::text[])`);
    params.push(ids);
  }
  if (biz.length) {
    conds.push(`s.${STORE_MAP.businessNo} = ANY($${i++}::text[])`);
    params.push(biz);
  }

  const sql = `
    SELECT
      s.${STORE_MAP.id} AS id,
      s.${STORE_MAP.businessNo} AS business_number,
      s.${STORE_MAP.businessName} AS business_name,
      s.${STORE_MAP.businessType} AS business_type,
      s.${STORE_MAP.category} AS business_category,
      s.${STORE_MAP.subcategory} AS business_subcategory
      ${imgSelectSql}
    FROM ${FOOD_TABLE} s
    ${imgJoinSql}
    WHERE ${conds.join(" OR ")}
  `;

  const { rows } = await pool.query(sql, params);

  const byId = new Map();
  const byBiz = new Map();
  for (const r of rows) {
    r.image_url = normalizeImageUrl(r.image_url);
    const id = String(r.id || "");
    const bn = String(r.business_number || "");
    if (id) byId.set(id, r);
    if (bn) byBiz.set(bn, r);
  }
  return { byId, byBiz };
}

async function hydrateSlotRowsWithStoreInfo(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return rows;

  const storeIds = [];
  const bizNos = [];
  for (const r of rows) {
    const sid = r?.store_id ?? r?.storeId ?? "";
    const bn = r?.business_no ?? r?.business_number ?? "";
    if (sid) storeIds.push(String(sid));
    if (bn) bizNos.push(String(bn));
  }

  const { byId, byBiz } = await fetchStoreMapByIdsOrBiz(storeIds, bizNos);

  for (const r of rows) {
    const sid = String(r?.store_id ?? r?.storeId ?? "");
    const bn = String((r?.business_no ?? r?.business_number ?? "")).replace(/[^\d]/g, "");

    const s = (sid && byId.get(sid)) || (bn && byBiz.get(bn)) || null;
    if (!s) continue;

    // 슬롯에 비어 있으면 store_info 값으로 채움
    if (!clean(r.business_name) && clean(s.business_name)) r.business_name = s.business_name;
    if (!clean(r.business_type) && clean(s.business_type)) r.business_type = s.business_type;

    // 응답에 business_category/subcategory를 "항상" 포함시키기(슬롯 테이블 컬럼 없어도 OK)
    if (!clean(r.business_category) && clean(s.business_category)) r.business_category = s.business_category;
    if (!clean(r.business_subcategory) && clean(s.business_subcategory)) r.business_subcategory = s.business_subcategory;

    // 이미지도 비어 있으면 store_images 메인 1장으로 채움
    if (!clean(r.image_url) && clean(s.image_url)) r.image_url = s.image_url;
  }

  return rows;
}

/** ----------------- API: stores (modal search/list) ----------------- */
export async function listStores(req, res) {
  try {
    const q = clean(req.query.q);
    const pageNo = Math.max(safeInt(req.query.pageNo, 1), 1);
    const pageSize = clamp(safeInt(req.query.pageSize, 20), 1, 100);
    const offset = (pageNo - 1) * pageSize;

    const qDigits = digitsOnly(q);

    const hasStoreImages = await ensureStoreImagesReady();

    const imgSelectSql = hasStoreImages ? `, COALESCE(img.url, '') AS image_url` : `, '' AS image_url`;

    const imgJoinSql = hasStoreImages
      ? `
      LEFT JOIN LATERAL (
        SELECT i.url
        FROM ${FOOD_IMAGE_TABLE} i
        WHERE i.store_id = s.${STORE_MAP.id}
        ORDER BY i.sort_order ASC NULLS LAST, i.id ASC
        LIMIT 1
      ) img ON true
    `
      : "";

    const where = [];
    const params = [];
    let i = 1;

    if (q) {
      const ors = [];

      if (qDigits) {
        ors.push(`s.${STORE_MAP.businessNo} ILIKE $${i++}`);
        params.push(`%${qDigits}%`);
      }

      ors.push(`s.${STORE_MAP.businessName} ILIKE $${i++}`);
      params.push(`%${q}%`);

      ors.push(`s.${STORE_MAP.businessType} ILIKE $${i++}`);
      params.push(`%${q}%`);

      where.push(`(${ors.join(" OR ")})`);
    }

    params.push(pageSize, offset);
    const limitIdx = i++;
    const offsetIdx = i++;

    const sql = `
      SELECT
        s.${STORE_MAP.id} AS id,
        s.${STORE_MAP.businessNo} AS business_number,
        s.${STORE_MAP.businessName} AS business_name,
        s.${STORE_MAP.businessType} AS business_type,
        s.${STORE_MAP.category} AS business_category,
        s.${STORE_MAP.subcategory} AS business_subcategory
        ${imgSelectSql}
      FROM ${FOOD_TABLE} s
      ${imgJoinSql}
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY s.${STORE_MAP.id} DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `;

    const { rows } = await pool.query(sql, params);
    for (const r of rows) r.image_url = normalizeImageUrl(r.image_url);

    return res.json({
      success: true,
      mode: "food",
      pageNo,
      pageSize,
      stores: rows,
    });
  } catch (err) {
    console.error("❌ [subcategoryFood listStores] error:", err);
    return res.status(500).json({ success: false, error: err?.message || "server error" });
  }
}

export async function searchStore(req, res) {
  return listStores(req, res);
}

export async function listCandidates(req, res) {
  return listStores(req, res);
}

/** ----------------- API: grid ----------------- */
/**
 * GET /subcategorymanager_food/ad/grid
 * - section=all_items => "실제 가게 목록" (store_info + store_images.url 메인 1장)
 * - 그 외 section => admin_ad_slots
 */
export async function grid(req, res) {
  try {
    const page = clean(req.query.page) || PAGE_NAME;
    const section = clean(req.query.section);

    // ✅ 한식만 subcategory 유지
    const norm = normalizeCategorySub(req.query.category, req.query.subcategory);
    let category = norm.category;
    let subcategory = norm.subcategory;

    // ✅ top 섹션은 공용
    if (section === "top") {
      category = "";
      subcategory = "";
    }

    const pageNo = Math.max(safeInt(req.query.pageNo, 1), 1);
    const pageSize = clamp(safeInt(req.query.pageSize, 12), 1, 50);
    const offset = (pageNo - 1) * pageSize;

    if (!section) return res.status(400).json({ success: false, error: "section is required" });

    // ✅ 1) all_items는 실제 가게 목록(= ndetail 메인 이미지 규칙과 동일)
    if (section === "all_items") {
      const hasStoreImages = await ensureStoreImagesReady();

      const imgSelectSql = hasStoreImages ? `, COALESCE(img.url, '') AS image_url` : `, '' AS image_url`;

      const imgJoinSql = hasStoreImages
        ? `
        LEFT JOIN LATERAL (
          SELECT i.url
          FROM ${FOOD_IMAGE_TABLE} i
          WHERE i.store_id = s.${STORE_MAP.id}
          ORDER BY i.sort_order ASC NULLS LAST, i.id ASC
          LIMIT 1
        ) img ON true
      `
        : "";

      const where = [];
      const params = [];
      let i = 1;

      if (category) {
        where.push(
          `btrim(replace(s.${STORE_MAP.category}::text, chr(160), ' ')) = btrim(replace($${i++}::text, chr(160), ' '))`
        );
        params.push(category);
      }

      // ✅ 한식만 subcategory(detail_category) 필터 적용
      if (subcategory) {
        where.push(
          `btrim(replace(s.${STORE_MAP.subcategory}::text, chr(160), ' ')) = btrim(replace($${i++}::text, chr(160), ' '))`
        );
        params.push(subcategory);
      }

      params.push(pageSize, offset);
      const limitIdx = i++;
      const offsetIdx = i++;

      const sql = `
        SELECT
          s.${STORE_MAP.id} AS id,
          s.${STORE_MAP.businessNo} AS business_number,
          s.${STORE_MAP.businessName} AS business_name,
          s.${STORE_MAP.businessType} AS business_type,
          s.${STORE_MAP.category} AS business_category,
          s.${STORE_MAP.subcategory} AS business_subcategory
          ${imgSelectSql}
        FROM ${FOOD_TABLE} s
        ${imgJoinSql}
        ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        ORDER BY s.${STORE_MAP.id} DESC
        LIMIT $${limitIdx} OFFSET $${offsetIdx}
      `;

      const { rows } = await pool.query(sql, params);
      for (const r of rows) r.image_url = normalizeImageUrl(r.image_url);

      return res.json({
        success: true,
        mode: "food",
        page,
        section,
        category,
        subcategory,
        pageNo,
        pageSize,
        items: rows,
      });
    }

    // ✅ 2) 나머지 섹션은 admin_ad_slots
    const cols = await getSlotsColumns();

    // ✅ 한식만 subcategory 포함된 prefix
    const prefixBase = [PAGE_NAME, "food", keyPart(category), keyPart(subcategory), keyPart(section)].join("|");
    const likePrefix = `${prefixBase}|%`;

    const selectCols = [];
    if (hasCol(cols, "id")) selectCols.push("id");
    if (hasCol(cols, "page")) selectCols.push("page");
    if (hasCol(cols, "position")) selectCols.push("position");
    if (hasCol(cols, "slot_type")) selectCols.push("slot_type");
    if (hasCol(cols, "slot_mode")) selectCols.push("slot_mode");
    if (hasCol(cols, "image_url")) selectCols.push("image_url");
    if (hasCol(cols, "link_url")) selectCols.push("link_url");
    if (hasCol(cols, "title")) selectCols.push("title");
    if (hasCol(cols, "subtitle")) selectCols.push("subtitle");
    if (hasCol(cols, "text")) selectCols.push("text");
    if (hasCol(cols, "store_id")) selectCols.push("store_id");
    if (hasCol(cols, "business_no")) selectCols.push("business_no");
    if (hasCol(cols, "business_number")) selectCols.push("business_number");
    if (hasCol(cols, "business_name")) selectCols.push("business_name");
    if (hasCol(cols, "business_type")) selectCols.push("business_type");
    if (hasCol(cols, "start_date")) selectCols.push("start_date");
    if (hasCol(cols, "end_date")) selectCols.push("end_date");
    if (hasCol(cols, "no_end")) selectCols.push("no_end");
    if (hasCol(cols, "priority")) selectCols.push("priority");
    if (hasCol(cols, "updated_at")) selectCols.push("updated_at");
    if (hasCol(cols, "created_at")) selectCols.push("created_at");

    const selectSql = selectCols.length ? selectCols.join(", ") : "*";

    const sql = hasCol(cols, "position")
      ? `
        SELECT ${selectSql}
        FROM ${SLOTS_TABLE}
        WHERE (${hasCol(cols, "page") ? "page = $1 AND " : ""} position LIKE $2)
        ORDER BY
          CASE
            WHEN position IS NULL THEN 999999
            ELSE COALESCE(NULLIF(regexp_replace(position, '.*\\|', ''), ''), '999999')::int
          END ASC
        LIMIT $3 OFFSET $4
      `
      : `
        SELECT ${selectSql}
        FROM ${SLOTS_TABLE}
        WHERE 1=0
        LIMIT $3 OFFSET $4
      `;

    const params = hasCol(cols, "page") ? [page, likePrefix, pageSize, offset] : ["", likePrefix, pageSize, offset];
    const { rows } = await pool.query(sql, params);

    // ✅ 슬롯에 store_id/business_no가 있으면 store_info + store_images로 보강
    await hydrateSlotRowsWithStoreInfo(rows);

    for (const r of rows) if ("image_url" in r) r.image_url = normalizeImageUrl(r.image_url);

    return res.json({
      success: true,
      mode: "food",
      page,
      section,
      category,
      subcategory,
      pageNo,
      pageSize,
      items: rows,
    });
  } catch (err) {
    console.error("❌ [subcategoryFood grid] error:", err);
    return res.status(500).json({ success: false, error: err?.message || "server error" });
  }
}

/** ----------------- API: slot read/save/delete ----------------- */
export async function getSlot(req, res) {
  try {
    const cols = await getSlotsColumns();

    const page = clean(req.query.page) || PAGE_NAME;
    const section = clean(req.query.section);

    // ✅ 한식만 subcategory 유지
    const norm = normalizeCategorySub(req.query.category, req.query.subcategory);
    const category = norm.category;
    const subcategory = norm.subcategory;

    const idx = Math.max(safeInt(req.query.idx, 1), 1);

    if (!section) return res.status(400).json({ success: false, error: "section is required" });
    if (!hasCol(cols, "position")) {
      return res.status(500).json({ success: false, error: "admin_ad_slots.position column missing" });
    }

    // ✅ 후보 position (전용 → 카테고리만 → 공용)
    const posSpecific = buildPosition({ mode: "food", category, subcategory, section, idx });
    const posCatOnly  = buildPosition({ mode: "food", category, subcategory: "", section, idx });
    const posGlobal   = buildPosition({ mode: "food", category: "", subcategory: "", section, idx });

    const candidates = [];
    candidates.push(posSpecific);

    // 전용이랑 다를 때만 추가
    if (posCatOnly !== posSpecific) candidates.push(posCatOnly);
    if (posGlobal !== posCatOnly) candidates.push(posGlobal);

    const selectCols = [];
    if (hasCol(cols, "id")) selectCols.push("id");
    if (hasCol(cols, "page")) selectCols.push("page");
    selectCols.push("position");
    if (hasCol(cols, "slot_type")) selectCols.push("slot_type");
    if (hasCol(cols, "slot_mode")) selectCols.push("slot_mode");
    if (hasCol(cols, "image_url")) selectCols.push("image_url");
    if (hasCol(cols, "link_url")) selectCols.push("link_url");
    if (hasCol(cols, "title")) selectCols.push("title");
    if (hasCol(cols, "subtitle")) selectCols.push("subtitle");
    if (hasCol(cols, "text")) selectCols.push("text");
    if (hasCol(cols, "store_id")) selectCols.push("store_id");
    if (hasCol(cols, "business_no")) selectCols.push("business_no");
    if (hasCol(cols, "business_number")) selectCols.push("business_number");
    if (hasCol(cols, "business_name")) selectCols.push("business_name");
    if (hasCol(cols, "business_type")) selectCols.push("business_type");
    if (hasCol(cols, "start_date")) selectCols.push("start_date");
    if (hasCol(cols, "end_date")) selectCols.push("end_date");
    if (hasCol(cols, "no_end")) selectCols.push("no_end");
    if (hasCol(cols, "priority")) selectCols.push("priority");
    if (hasCol(cols, "updated_at")) selectCols.push("updated_at");
    if (hasCol(cols, "created_at")) selectCols.push("created_at");

    // ✅ 하나씩 조회해서 첫 번째로 찾는 슬롯 반환
    let slot = null;
    let resolvedPosition = posSpecific;

    for (const p of candidates) {
      const sql = `
        SELECT ${selectCols.join(", ")}
        FROM ${SLOTS_TABLE}
        WHERE ${hasCol(cols, "page") ? "page = $1 AND " : ""} position = $2
        LIMIT 1
      `;
      const params = hasCol(cols, "page") ? [page, p] : ["", p];
      const { rows } = await pool.query(sql, params);

      if (rows[0]) {
        slot = rows[0];
        resolvedPosition = p;
        break;
      }
    }

    if (slot?.image_url) slot.image_url = normalizeImageUrl(slot.image_url);

    return res.json({ success: true, mode: "food", page, position: resolvedPosition, slot });
  } catch (err) {
    console.error("❌ [subcategoryFood getSlot] error:", err);
    return res.status(500).json({ success: false, error: err?.message || "server error" });
  }
}

export async function upsertSlot(req, res) {
  try {
    const cols = await getSlotsColumns();

    const page = clean(req.body.page) || PAGE_NAME;
    const section = clean(req.body.section);

    // ✅ top 배너는 공용 1장: category/subcategory 무조건 무시
    let category = clean(req.body.category);
    let subcategory = clean(req.body.subcategory);
    if (section === "top") {
      category = "";
      subcategory = "";
    } else {
      const norm = normalizeCategorySub(category, subcategory);
      category = norm.category;
      subcategory = norm.subcategory;
    }

    const idx = Math.max(safeInt(req.body.idx, 1), 1);

    if (!section) return res.status(400).json({ success: false, error: "section is required" });
    if (!hasCol(cols, "position")) {
      return res.status(500).json({ success: false, error: "admin_ad_slots.position column missing" });
    }

    const position = buildPosition({ mode: "food", category, subcategory, section, idx });

    const uploadedImageUrl = safePublicImageUrl(req.file);
    const bodyImageUrl = clean(req.body.image_url);
    const imageUrl = normalizeImageUrl(uploadedImageUrl || bodyImageUrl);

    // ✅ adMode를 slot_type으로 매핑 (banner/text만 허용)
    const adMode = clean(req.body.adMode || req.body.ad_mode);
    const slotType = mapSlotType(adMode);
    const slotMode = clean(req.body.slot_mode || req.body.slotMode);

    const title = clean(req.body.title);
    const subtitle = clean(req.body.subtitle);
    const text = clean(req.body.text);
    const linkUrl = clean(req.body.link_url || req.body.linkUrl);

    const storeId = clean(req.body.store_id || req.body.storeId);
    const businessNo = digitsOnly(req.body.business_no || req.body.businessNo || req.body.business_number);

    const businessName = clean(req.body.business_name);
    const businessType = clean(req.body.business_type);

    const startDate = safeDateOrNull(req.body.start_date);
    const endDate = safeDateOrNull(req.body.end_date);
    const noEnd = toBool(req.body.no_end);
    const priority = safeInt(req.body.priority, 0);

    // 기존 이미지 제거 대비
    let oldImageUrl = "";
    if (uploadedImageUrl && hasCol(cols, "image_url")) {
      const q = `
        SELECT image_url
        FROM ${SLOTS_TABLE}
        WHERE ${hasCol(cols, "page") ? "page = $1 AND " : ""} position = $2
        LIMIT 1
      `;
      const p = hasCol(cols, "page") ? [page, position] : ["", position];
      const { rows } = await pool.query(q, p);
      oldImageUrl = rows?.[0]?.image_url || "";
    }

    const data = {};
    if (hasCol(cols, "page")) data.page = page;
    data.position = position;

    if (hasCol(cols, "slot_type")) data.slot_type = slotType;
    if (hasCol(cols, "slot_mode")) data.slot_mode = slotMode;

    if (hasCol(cols, "image_url")) data.image_url = imageUrl;
    if (hasCol(cols, "link_url")) data.link_url = linkUrl;

    if (hasCol(cols, "title")) data.title = title;
    if (hasCol(cols, "subtitle")) data.subtitle = subtitle;
    if (hasCol(cols, "text")) data.text = text;

    if (hasCol(cols, "store_id")) data.store_id = storeId || null;
    if (hasCol(cols, "business_no")) data.business_no = businessNo;
    if (hasCol(cols, "business_number")) data.business_number = businessNo;

    if (hasCol(cols, "business_name")) data.business_name = businessName;
    if (hasCol(cols, "business_type")) data.business_type = businessType;

    if (hasCol(cols, "start_date")) data.start_date = startDate;
    if (hasCol(cols, "end_date")) data.end_date = endDate;
    if (hasCol(cols, "no_end")) data.no_end = noEnd;

    if (hasCol(cols, "priority")) data.priority = priority;
    if (hasCol(cols, "updated_at")) data.updated_at = new Date().toISOString();

    const setKeys = Object.keys(data).filter((k) => k !== "position" && k !== "page");
    const setSql = setKeys.map((k, n) => `${k} = $${n + 3}`).join(", ");
    const setParams = setKeys.map((k) => data[k]);

    const updateSql = `
      UPDATE ${SLOTS_TABLE}
      SET ${setSql || "position = position"}
      WHERE ${hasCol(cols, "page") ? "page = $1 AND " : ""} position = $2
      RETURNING *
    `;
    const updateParams = hasCol(cols, "page") ? [page, position, ...setParams] : ["", position, ...setParams];
    const upd = await pool.query(updateSql, updateParams);

    let row = upd.rows?.[0] || null;

    if (!row) {
      const insertKeys = Object.keys(data);
      const insertVals = insertKeys.map((_, n) => `$${n + 1}`).join(", ");
      const insertSql = `
        INSERT INTO ${SLOTS_TABLE} (${insertKeys.join(", ")})
        VALUES (${insertVals})
        RETURNING *
      `;
      const insertParams = insertKeys.map((k) => data[k]);
      const ins = await pool.query(insertSql, insertParams);
      row = ins.rows?.[0] || null;
    }

    if (uploadedImageUrl && oldImageUrl && oldImageUrl !== uploadedImageUrl) safeUnlinkIfMine(oldImageUrl);

    if (row?.image_url) row.image_url = normalizeImageUrl(row.image_url);

    return res.json({ success: true, mode: "food", page, position, slot: row });
  } catch (err) {
    console.error("❌ [subcategoryFood upsertSlot] error:", err);
    return res.status(500).json({ success: false, error: err?.message || "server error" });
  }
}

export async function deleteSlot(req, res) {
  try {
    const cols = await getSlotsColumns();

    const page = clean(req.query.page) || PAGE_NAME;
    const section = clean(req.query.section);

    // ✅ top 배너는 공용 1장: category/subcategory 무조건 무시
    let category = clean(req.query.category);
    let subcategory = clean(req.query.subcategory);
    if (section === "top") {
      category = "";
      subcategory = "";
    } else {
      const norm = normalizeCategorySub(category, subcategory);
      category = norm.category;
      subcategory = norm.subcategory;
    }

    const idx = Math.max(safeInt(req.query.idx, 1), 1);

    if (!section) return res.status(400).json({ success: false, error: "section is required" });
    if (!hasCol(cols, "position")) {
      return res.status(500).json({ success: false, error: "admin_ad_slots.position column missing" });
    }

    const position = buildPosition({ mode: "food", category, subcategory, section, idx });

    let imageUrl = "";
    if (hasCol(cols, "image_url")) {
      const q = `
        SELECT image_url
        FROM ${SLOTS_TABLE}
        WHERE ${hasCol(cols, "page") ? "page = $1 AND " : ""} position = $2
        LIMIT 1
      `;
      const p = hasCol(cols, "page") ? [page, position] : ["", position];
      const { rows } = await pool.query(q, p);
      imageUrl = rows?.[0]?.image_url || "";
    }

    const delSql = `
      DELETE FROM ${SLOTS_TABLE}
      WHERE ${hasCol(cols, "page") ? "page = $1 AND " : ""} position = $2
    `;
    const delParams = hasCol(cols, "page") ? [page, position] : ["", position];
    const r = await pool.query(delSql, delParams);

    if (imageUrl) safeUnlinkIfMine(imageUrl);

    return res.json({ success: true, mode: "food", page, position, deleted: r.rowCount || 0 });
  } catch (err) {
    console.error("❌ [subcategoryFood deleteSlot] error:", err);
    return res.status(500).json({ success: false, error: err?.message || "server error" });
  }
}

/** ----------------- API: where (optional) ----------------- */
/**
 * GET /subcategorymanager_food/ad/where?q=사업자번호
 * - admin_ad_slots에서 해당 사업자번호가 저장된 슬롯 위치들을 반환
 */
export async function whereSlots(req, res) {
  try {
    const cols = await getSlotsColumns();

    const page = clean(req.query.page) || PAGE_NAME; // subcategory
    const q = digitsOnly(req.query.q);
    const limit = clamp(safeInt(req.query.limit, 200), 1, 500);

    if (!q) return res.status(400).json({ success: false, error: "q is required" });

    // 슬롯 테이블에 어떤 컬럼이 있는지에 따라 조건 구성 (프로젝트마다 다르니까 안전하게)
    const bnCol =
      hasCol(cols, "business_number") ? "business_number" :
      hasCol(cols, "business_no") ? "business_no" :
      null;

    if (!bnCol) {
      return res.status(500).json({
        success: false,
        error: "admin_ad_slots에 business_number/business_no 컬럼이 없습니다.",
      });
    }

    const selectCols = [];
    if (hasCol(cols, "page")) selectCols.push("page");
    if (hasCol(cols, "position")) selectCols.push("position");
    if (hasCol(cols, "priority")) selectCols.push("priority");
    if (hasCol(cols, "slot_type")) selectCols.push("slot_type");
    if (hasCol(cols, "slot_mode")) selectCols.push("slot_mode");
    if (hasCol(cols, "start_date")) selectCols.push("start_date");
    if (hasCol(cols, "end_date")) selectCols.push("end_date");
    if (hasCol(cols, "no_end")) selectCols.push("no_end");
    if (hasCol(cols, "updated_at")) selectCols.push("updated_at");
    if (hasCol(cols, "created_at")) selectCols.push("created_at");

    // 최소 컬럼
    if (!selectCols.length) selectCols.push("*");

    const sql = `
      SELECT ${selectCols.join(", ")}
      FROM ${SLOTS_TABLE}
      WHERE ${hasCol(cols, "page") ? "page = $1 AND " : ""} ${bnCol} LIKE $2
      ORDER BY updated_at DESC NULLS LAST
      LIMIT $3
    `;
    const params = hasCol(cols, "page") ? [page, `%${q}%`, limit] : ["", `%${q}%`, limit];

    const { rows } = await pool.query(sql, params);

    // position 파싱(우리 position 규칙: subcategory|food|category|subcategory|section|idx)
    const parsed = (pos) => {
      const parts = String(pos || "").split("|");
      if (parts.length < 6) return null;
      return {
        page: parts[0] || "",
        mode: parts[1] || "",
        category: parts[2] || "",
        subcategory: parts[3] || "",
        section: parts[4] || "",
        idx: safeInt(parts[5], null),
      };
    };

    const items = rows.map((r) => ({
      ...r,
      parsed: hasCol(cols, "position") ? parsed(r.position) : null,
    }));

    return res.json({ success: true, mode: "food", page, q, items });
  } catch (err) {
    console.error("❌ [subcategoryFood whereSlots] error:", err);
    return res.status(500).json({ success: false, error: err?.message || "server error" });
  }
}

