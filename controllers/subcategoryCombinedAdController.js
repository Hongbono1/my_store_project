// controllers/subcategoryCombinedAdController.js
import fs from "fs";
import path from "path";
import crypto from "crypto";
import pool from "../db.js";

/**
 * ----------------------------------------------------------
 *  Subcategory Manager (COMBINED) - Controller (Full)
 *  - Upload dir: /data/uploads/manager_ad
 *  - Slot table: public.admin_ad_slots
 *  - Combined stores: public.combined_store_info (기본)
 *  - Images: (가능하면) combined_store_images/combined_store_image 등 탐색
 *            없으면 combined_store_info.main_image_url / image_url 계열 컬럼 탐색
 *  - top 배너는 "공용 1장" 고정 (카테고리/서브카테고리 무시)  ✅ 지금 정책
 * ----------------------------------------------------------
 */

// 업로드 경로(푸드와 동일)
export const UPLOAD_SUBDIR = "manager_ad";
export const UPLOAD_ABS_DIR = path.join("/data/uploads", UPLOAD_SUBDIR);
export const UPLOAD_PUBLIC_PREFIX = `/uploads/${UPLOAD_SUBDIR}`;

// 슬롯 테이블(기존 재사용)
const SLOTS_TABLE = "public.admin_ad_slots";

// ✅ 통합 가게 테이블(확정/우선)
const COMBINED_TABLE = "public.combined_store_info";

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

function normalizeImageUrl(u) {
  const s = clean(u);
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("/")) return s;
  return `/${s}`;
}

function normalizeEqSql(col, paramIdx) {
  // NBSP(160) 포함된 경우까지 정규화 비교
  return `btrim(replace(${col}::text, chr(160), ' ')) = btrim(replace($${paramIdx}::text, chr(160), ' '))`;
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

/** ----------------- combined_store_info columns 탐색 ----------------- */
let _combinedColsCache = null;

async function getCombinedColumns() {
  if (_combinedColsCache) return _combinedColsCache;

  const sql = `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = $1 AND table_name = $2
  `;
  const [schema, table] = COMBINED_TABLE.split(".");
  const { rows } = await pool.query(sql, [
    schema.replaceAll('"', ""),
    table.replaceAll('"', ""),
  ]);

  const cols = new Set(rows.map((r) => r.column_name));
  _combinedColsCache = cols;
  return cols;
}

function pickCol(cols, candidates, fallback = "") {
  for (const c of candidates) {
    if (cols.has(c)) return c;
  }
  return fallback;
}

async function getCombinedMap() {
  const cols = await getCombinedColumns();

  // 통합 테이블에서 자주 쓰는 후보 컬럼들
  const MAP = {
    id: pickCol(cols, ["id", "store_id"], "id"),
    businessNo: pickCol(cols, ["business_number", "business_no", "biz_no", "biz_number"], "business_number"),
    businessName: pickCol(cols, ["business_name", "store_name", "name"], "business_name"),
    businessType: pickCol(cols, ["business_type", "type", "store_type"], "business_type"),
    category: pickCol(cols, ["business_category", "category", "main_category"], "business_category"),
    subcategory: pickCol(cols, ["detail_category", "subcategory", "sub_category", "subcat"], "detail_category"),
    // 이미지 직접 컬럼 후보
    mainImage: pickCol(cols, ["main_image_url", "image_url", "main_image", "thumbnail_url"], ""),
  };

  return { cols, MAP };
}

/** ----------------- combined images source 탐색 ----------------- */
let _combinedImageSourceCache = null;

/**
 * 반환 예:
 *  - { type: "table", table: "public.combined_store_images", storeIdCol:"store_id", urlCol:"url", orderSql:"ORDER BY sort_order..." }
 *  - { type: "col", col: "main_image_url" }
 *  - { type: "none" }
 */
async function ensureCombinedImageSource() {
  if (_combinedImageSourceCache) return _combinedImageSourceCache;

  const { cols, MAP } = await getCombinedMap();

  // 1) 테이블 후보들 먼저 탐색
  const tableCandidates = [
    "public.combined_store_images",
    "public.combined_store_image",
    "public.combined_images",
    "public.store_images", // 혹시 통합도 같이 쓰는 경우 대비(있으면 활용)
  ];

  for (const t of tableCandidates) {
    const { rows: r0 } = await pool.query("SELECT to_regclass($1) AS reg", [t]);
    if (!r0?.[0]?.reg) continue;

    const [schema, table] = t.split(".");
    const { rows } = await pool.query(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2
    `,
      [schema, table]
    );
    const tcols = new Set(rows.map((x) => x.column_name));

    const storeIdCol = tcols.has("store_id")
      ? "store_id"
      : tcols.has("combined_store_id")
      ? "combined_store_id"
      : tcols.has("id_store")
      ? "id_store"
      : "";

    const urlCol = tcols.has("url")
      ? "url"
      : tcols.has("image_url")
      ? "image_url"
      : tcols.has("path")
      ? "path"
      : "";

    if (storeIdCol && urlCol) {
      const hasSort = tcols.has("sort_order");
      const hasId = tcols.has("id");
      const orderSql = [
        hasSort ? "sort_order ASC NULLS LAST" : null,
        hasId ? "id ASC" : null,
      ]
        .filter(Boolean)
        .join(", ");

      _combinedImageSourceCache = {
        type: "table",
        table: t,
        storeIdCol,
        urlCol,
        orderSql: orderSql ? `ORDER BY ${orderSql}` : "",
      };
      return _combinedImageSourceCache;
    }
  }

  // 2) 테이블이 없으면 combined_store_info의 이미지 컬럼 사용
  if (MAP.mainImage) {
    _combinedImageSourceCache = { type: "col", col: MAP.mainImage };
    return _combinedImageSourceCache;
  }

  _combinedImageSourceCache = { type: "none" };
  return _combinedImageSourceCache;
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

/** ----------------- position 규칙 (COMBINED) -----------------
 * 지금 정책:
 * - top 배너는 공용 1장 => category/subcategory 무시
 *
 * position = subcategory|combined|{category}|{subcategory}|{section}|{idx}
 */
function normalizeCategorySub({ section, category, subcategory }) {
  const sec = clean(section);
  let cat = clean(category);
  let sub = clean(subcategory);

  // ✅ 지금은 top 배너는 공용만 사용
  if (sec === "top") {
    cat = "";
    sub = "";
  }

  // category 없으면 sub도 제거
  if (!cat) sub = "";

  return { category: cat, subcategory: sub };
}

function buildPosition({ mode = "combined", category = "", subcategory = "", section = "", idx = 1 }) {
  const norm = normalizeCategorySub({ section, category, subcategory });

  return [
    PAGE_NAME,
    keyPart(mode || "combined"),
    keyPart(norm.category),
    keyPart(norm.subcategory),
    keyPart(section),
    String(idx),
  ].join("|");
}

/** ----------------- store fetch (list/search) ----------------- */
async function listCombinedStores({ q = "", pageNo = 1, pageSize = 20, category = "", subcategory = "" }) {
  const { MAP } = await getCombinedMap();
  const imgSource = await ensureCombinedImageSource();

  const offset = (pageNo - 1) * pageSize;

  const where = [];
  const params = [];
  let i = 1;

  const qq = clean(q);
  const qDigits = digitsOnly(qq);

  // 검색(사업자번호/상호/업종)
  if (qq) {
    const ors = [];
    if (qDigits) {
      ors.push(`s.${MAP.businessNo} ILIKE $${i++}`);
      params.push(`%${qDigits}%`);
    }
    ors.push(`s.${MAP.businessName} ILIKE $${i++}`);
    params.push(`%${qq}%`);

    if (MAP.businessType) {
      ors.push(`s.${MAP.businessType} ILIKE $${i++}`);
      params.push(`%${qq}%`);
    }
    where.push(`(${ors.join(" OR ")})`);
  }

  // 카테고리/서브카테고리 필터(통합은 그대로 적용)
  const cat = clean(category);
  const sub = clean(subcategory);

  if (cat) {
    where.push(normalizeEqSql(`s.${MAP.category}`, i++));
    params.push(cat);
  }
  if (sub) {
    where.push(normalizeEqSql(`s.${MAP.subcategory}`, i++));
    params.push(sub);
  }

  // 이미지 select/join
  let imgSelectSql = `, '' AS image_url`;
  let imgJoinSql = "";

  if (imgSource.type === "table") {
    imgSelectSql = `, COALESCE(img.${imgSource.urlCol}, '') AS image_url`;
    imgJoinSql = `
      LEFT JOIN LATERAL (
        SELECT i.${imgSource.urlCol}
        FROM ${imgSource.table} i
        WHERE i.${imgSource.storeIdCol} = s.${MAP.id}
        ${imgSource.orderSql}
        LIMIT 1
      ) img ON true
    `;
  } else if (imgSource.type === "col") {
    imgSelectSql = `, COALESCE(s.${imgSource.col}, '') AS image_url`;
  }

  // LIMIT/OFFSET
  params.push(pageSize, offset);
  const limitIdx = i++;
  const offsetIdx = i++;

  const sql = `
    SELECT
      s.${MAP.id} AS id,
      s.${MAP.businessNo} AS business_number,
      s.${MAP.businessName} AS business_name,
      s.${MAP.businessType} AS business_type,
      s.${MAP.category} AS business_category,
      s.${MAP.subcategory} AS business_subcategory
      ${imgSelectSql}
    FROM ${COMBINED_TABLE} s
    ${imgJoinSql}
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY s.${MAP.id} DESC
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `;

  const { rows } = await pool.query(sql, params);
  for (const r of rows) r.image_url = normalizeImageUrl(r.image_url);

  return rows;
}

/** ----------------- exports: stores ----------------- */
export async function listStores(req, res) {
  try {
    const q = clean(req.query.q);
    const pageNo = Math.max(safeInt(req.query.pageNo, 1), 1);
    const pageSize = clamp(safeInt(req.query.pageSize, 20), 1, 100);

    // 통합은 category/subcategory 그대로
    const category = clean(req.query.category);
    const subcategory = clean(req.query.subcategory);

    const stores = await listCombinedStores({ q, pageNo, pageSize, category, subcategory });

    return res.json({
      success: true,
      mode: "combined",
      pageNo,
      pageSize,
      stores,
    });
  } catch (err) {
    console.error("❌ [subcategoryCombined listStores] error:", err);
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
 * GET /subcategorymanager_combined/ad/grid
 * - section=all_items => "통합 가게 목록" (combined_store_info + 이미지)
 * - 그 외 section => admin_ad_slots
 */
export async function grid(req, res) {
  try {
    const page = clean(req.query.page) || PAGE_NAME;
    const section = clean(req.query.section);

    const category = clean(req.query.category);
    const subcategory = clean(req.query.subcategory);

    const pageNo = Math.max(safeInt(req.query.pageNo, 1), 1);
    const pageSize = clamp(safeInt(req.query.pageSize, 12), 1, 50);
    const offset = (pageNo - 1) * pageSize;

    if (!section) return res.status(400).json({ success: false, error: "section is required" });

    // ✅ 1) all_items는 통합 가게 목록
    if (section === "all_items") {
      const items = await listCombinedStores({
        q: "",
        pageNo,
        pageSize,
        category,
        subcategory,
      });

      return res.json({
        success: true,
        mode: "combined",
        page,
        section,
        category,
        subcategory,
        pageNo,
        pageSize,
        items,
      });
    }

    // ✅ 2) 나머지 섹션은 admin_ad_slots
    const cols = await getSlotsColumns();

    const norm = normalizeCategorySub({ section, category, subcategory });
    const prefixBase = [PAGE_NAME, "combined", keyPart(norm.category), keyPart(norm.subcategory), keyPart(section)].join("|");
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

    for (const r of rows) if ("image_url" in r) r.image_url = normalizeImageUrl(r.image_url);

    return res.json({
      success: true,
      mode: "combined",
      page,
      section,
      category: norm.category,
      subcategory: norm.subcategory,
      pageNo,
      pageSize,
      items: rows,
    });
  } catch (err) {
    console.error("❌ [subcategoryCombined grid] error:", err);
    return res.status(500).json({ success: false, error: err?.message || "server error" });
  }
}

/** ----------------- API: slot read/save/delete ----------------- */
export async function getSlot(req, res) {
  try {
    const cols = await getSlotsColumns();

    const page = clean(req.query.page) || PAGE_NAME;
    const section = clean(req.query.section);

    const category = clean(req.query.category);
    const subcategory = clean(req.query.subcategory);
    const idx = Math.max(safeInt(req.query.idx, 1), 1);

    if (!section) return res.status(400).json({ success: false, error: "section is required" });
    if (!hasCol(cols, "position")) {
      return res.status(500).json({ success: false, error: "admin_ad_slots.position column missing" });
    }

    const position = buildPosition({ mode: "combined", category, subcategory, section, idx });

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

    const sql = `
      SELECT ${selectCols.join(", ")}
      FROM ${SLOTS_TABLE}
      WHERE ${hasCol(cols, "page") ? "page = $1 AND " : ""} position = $2
      LIMIT 1
    `;
    const params = hasCol(cols, "page") ? [page, position] : ["", position];
    const { rows } = await pool.query(sql, params);

    const slot = rows[0] || null;
    if (slot?.image_url) slot.image_url = normalizeImageUrl(slot.image_url);

    return res.json({ success: true, mode: "combined", page, position, slot });
  } catch (err) {
    console.error("❌ [subcategoryCombined getSlot] error:", err);
    return res.status(500).json({ success: false, error: err?.message || "server error" });
  }
}

export async function upsertSlot(req, res) {
  try {
    const cols = await getSlotsColumns();

    const page = clean(req.body.page) || PAGE_NAME;
    const section = clean(req.body.section);

    const category = clean(req.body.category);
    const subcategory = clean(req.body.subcategory);
    const idx = Math.max(safeInt(req.body.idx, 1), 1);

    if (!section) return res.status(400).json({ success: false, error: "section is required" });
    if (!hasCol(cols, "position")) {
      return res.status(500).json({ success: false, error: "admin_ad_slots.position column missing" });
    }

    const position = buildPosition({ mode: "combined", category, subcategory, section, idx });

    const uploadedImageUrl = safePublicImageUrl(req.file);
    const bodyImageUrl = clean(req.body.image_url);
    const imageUrl = normalizeImageUrl(uploadedImageUrl || bodyImageUrl);

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

    // 기존 이미지 삭제 대비
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

    return res.json({ success: true, mode: "combined", page, position, slot: row });
  } catch (err) {
    console.error("❌ [subcategoryCombined upsertSlot] error:", err);
    return res.status(500).json({ success: false, error: err?.message || "server error" });
  }
}

export async function deleteSlot(req, res) {
  try {
    const cols = await getSlotsColumns();

    const page = clean(req.query.page) || PAGE_NAME;
    const section = clean(req.query.section);

    const category = clean(req.query.category);
    const subcategory = clean(req.query.subcategory);
    const idx = Math.max(safeInt(req.query.idx, 1), 1);

    if (!section) return res.status(400).json({ success: false, error: "section is required" });
    if (!hasCol(cols, "position")) {
      return res.status(500).json({ success: false, error: "admin_ad_slots.position column missing" });
    }

    const position = buildPosition({ mode: "combined", category, subcategory, section, idx });

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

    return res.json({ success: true, mode: "combined", page, position, deleted: r.rowCount || 0 });
  } catch (err) {
    console.error("❌ [subcategoryCombined deleteSlot] error:", err);
    return res.status(500).json({ success: false, error: err?.message || "server error" });
  }
}

/** ----------------- optional: whereSlots ----------------- */
export async function whereSlots(req, res) {
  try {
    const { MAP } = await getCombinedMap();

    const storeId = clean(req.query.store_id || req.query.storeId);
    const businessNo = digitsOnly(req.query.business_number || req.query.business_no || req.query.biz);

    if (!storeId && !businessNo) {
      return res.status(400).json({ success: false, error: "store_id or business_number required" });
    }

    const conds = [];
    const params = [];
    let i = 1;

    if (storeId) {
      conds.push(`s.${MAP.id}::text = $${i++}`);
      params.push(String(storeId));
    }
    if (businessNo) {
      conds.push(`s.${MAP.businessNo} = $${i++}`);
      params.push(String(businessNo));
    }

    const sql = `
      SELECT s.${MAP.id} AS id, s.${MAP.businessNo} AS business_number, s.${MAP.businessName} AS business_name
      FROM ${COMBINED_TABLE} s
      WHERE ${conds.join(" OR ")}
      LIMIT 20
    `;
    const { rows } = await pool.query(sql, params);

    return res.json({ success: true, mode: "combined", results: rows });
  } catch (err) {
    console.error("❌ [subcategoryCombined whereSlots] error:", err);
    return res.status(500).json({ success: false, error: err?.message || "server error" });
  }
}
