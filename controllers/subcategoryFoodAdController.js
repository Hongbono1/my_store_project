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
 *  - Food stores: public.store_info (네 DB 기준)
 *  - Images:
 *      1) public.food_store_images (있고 데이터 있으면 우선)
 *      2) fallback: public.store_menu.image_url (네 ndetail 이미지가 여기 있음)
 *  - section=all_items => "실제 가게 목록" + images[] + image_url(images[0])
 * ----------------------------------------------------------
 */

// 업로드 경로(다른 매니저와 동일)
export const UPLOAD_SUBDIR = "manager_ad";
export const UPLOAD_ABS_DIR = path.join("/data/uploads", UPLOAD_SUBDIR);
export const UPLOAD_PUBLIC_PREFIX = `/uploads/${UPLOAD_SUBDIR}`;

// 슬롯 테이블(기존 재사용)
const SLOTS_TABLE = "public.admin_ad_slots";

// FOOD 가게 테이블
const FOOD_TABLE = "public.store_info";

// FOOD 이미지 테이블(있으면 우선)
const FOOD_IMAGE_TABLE = "public.food_store_images";

// ✅ ndetail에서 실제로 보이는 업로드 경로가 들어있는 곳(네 DB 확인 결과)
const STORE_MENU_TABLE = "public.store_menu";

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

/**
 * position 규칙(FOOD)
 * subcategory|food|{category}|{subcategory}|{section}|{idx}
 */
function buildPosition({ mode = "food", category = "", subcategory = "", section = "", idx = 1 }) {
  return [
    PAGE_NAME,
    keyPart(mode || "food"),
    keyPart(category),
    keyPart(subcategory),
    keyPart(section),
    String(idx),
  ].join("|");
}

function normalizeImageUrl(u) {
  const s = clean(u);
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("/")) return s;
  return `/${s}`;
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
  const { rows } = await pool.query(sql, [schema.replaceAll('"', ""), table.replaceAll('"', "")]);
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
  subcategory: "detail_category", // store_info는 detail_category가 서브카테고리
};

/** ----------------- 이미지 소스 결정: food_store_images -> fallback store_menu ----------------- */
let _imageSourceCache = null;

/**
 * 이미지 소스 구조:
 * {
 *   source: "food_store_images" | "store_menu" | null,
 *   table: "public.xxx",
 *   keyCol: "...",          // join key
 *   keyMode: "store_id"|"business_number",
 *   orderBy: "ORDER BY ...",
 *   imageCol: "image_url",
 * }
 */
async function detectImageSource() {
  if (_imageSourceCache) return _imageSourceCache;

  // 1) food_store_images 존재 + 데이터 있으면 우선
  const f = await detectTableImageSource(FOOD_IMAGE_TABLE, /*prefer*/ true);
  if (f?.hasAnyRow) {
    _imageSourceCache = {
      source: "food_store_images",
      table: FOOD_IMAGE_TABLE,
      keyCol: f.keyCol,
      keyMode: f.keyMode,
      orderBy: f.orderBy,
      imageCol: "image_url",
    };
    return _imageSourceCache;
  }

  // 2) fallback: store_menu (네가 실제로 이미지가 존재하는 곳)
  const m = await detectTableImageSource(STORE_MENU_TABLE, /*prefer*/ false);
  if (m?.exists) {
    _imageSourceCache = {
      source: "store_menu",
      table: STORE_MENU_TABLE,
      keyCol: m.keyCol,
      keyMode: m.keyMode,
      orderBy: m.orderBy,
      imageCol: "image_url",
    };
    return _imageSourceCache;
  }

  _imageSourceCache = null;
  return null;
}

async function detectTableImageSource(tableName, checkHasAnyRow) {
  // 존재 확인
  const { rows: r0 } = await pool.query("SELECT to_regclass($1) AS reg", [tableName]);
  const exists = !!r0?.[0]?.reg;
  if (!exists) return { exists: false };

  // 컬럼 확인
  const [schema, table] = tableName.split(".");
  const { rows } = await pool.query(
    `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = $1 AND table_name = $2
  `,
    [schema, table]
  );
  const cols = new Set(rows.map((x) => x.column_name));

  // join 키 후보 (네 테이블들은 store_id가 있을 가능성이 높음)
  // - store_menu 쪽: store_id / storeinfo_id / business_number / business_no 후보
  // - food_store_images: store_id가 있는 걸 네가 이미 확인했음
  const keyCol =
    (cols.has("store_id") && "store_id") ||
    (cols.has("storeinfo_id") && "storeinfo_id") ||
    (cols.has("business_number") && "business_number") ||
    (cols.has("business_no") && "business_no") ||
    "";

  if (!keyCol) return { exists: true, keyCol: "", keyMode: "", orderBy: "", hasAnyRow: false };

  const keyMode = keyCol === "store_id" || keyCol === "storeinfo_id" ? "store_id" : "business_number";

  // 대표 이미지 정렬 후보
  const orderParts = [];
  if (cols.has("is_main")) orderParts.push("i.is_main DESC");
  if (cols.has("priority")) orderParts.push("i.priority ASC");
  if (cols.has("sort_order")) orderParts.push("i.sort_order ASC");
  if (cols.has("id")) orderParts.push("i.id ASC");
  if (cols.has("created_at")) orderParts.push("i.created_at ASC");
  const orderBy = orderParts.length ? `ORDER BY ${orderParts.join(", ")}` : "";

  // 데이터 존재 여부(옵션)
  let hasAnyRow = false;
  if (checkHasAnyRow) {
    try {
      const { rows: r1 } = await pool.query(`SELECT 1 AS ok FROM ${tableName} LIMIT 1`);
      hasAnyRow = !!(r1 && r1.length);
    } catch {
      hasAnyRow = false;
    }
  }

  return { exists: true, keyCol, keyMode, orderBy, hasAnyRow };
}

/**
 * store_info 한 행에 대해 images[] (최대 3장) + image_url(images[0])를 만드는 LATERAL JOIN
 */
async function buildImagesLateralJoin(alias = "s") {
  const src = await detectImageSource();
  if (!src) {
    return {
      selectSql: `, ARRAY[]::text[] AS images, '' AS image_url`,
      joinSql: ``,
    };
  }

  const joinKeyExpr =
    src.keyMode === "store_id"
      ? `i.${src.keyCol} = ${alias}.${STORE_MAP.id}`
      : `i.${src.keyCol} = ${alias}.${STORE_MAP.businessNo}`;

  // ⚠️ 이미지가 NULL/빈문자면 제외
  const joinSql = `
    LEFT JOIN LATERAL (
      SELECT
        COALESCE(
          ARRAY_AGG(x.${src.imageCol} ORDER BY x.rn)
            FILTER (WHERE NULLIF(x.${src.imageCol}, '') IS NOT NULL),
          ARRAY[]::text[]
        ) AS images
      FROM (
        SELECT
          i.${src.imageCol},
          ROW_NUMBER() OVER (
            ${src.orderBy ? src.orderBy : "ORDER BY i." + src.imageCol + " ASC"}
          ) AS rn
        FROM ${src.table} i
        WHERE ${joinKeyExpr}
          AND NULLIF(i.${src.imageCol}, '') IS NOT NULL
        LIMIT 3
      ) x
    ) img ON true
  `;

  // images[1]이 첫번째 (Postgres 배열 1-based)
  const selectSql = `
    , COALESCE(img.images, ARRAY[]::text[]) AS images
    , COALESCE(img.images[1], '') AS image_url
  `;

  return { selectSql, joinSql };
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

/** ----------------- API: stores (modal search/list) ----------------- */
export async function listStores(req, res) {
  try {
    const q = clean(req.query.q);
    const pageNo = Math.max(safeInt(req.query.pageNo, 1), 1);
    const pageSize = clamp(safeInt(req.query.pageSize, 20), 1, 100);
    const offset = (pageNo - 1) * pageSize;

    const qDigits = digitsOnly(q);

    const { selectSql: imgSelectSql, joinSql: imgJoinSql } = await buildImagesLateralJoin("s");

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

    // normalize
    for (const r of rows) {
      r.image_url = normalizeImageUrl(r.image_url);
      if (Array.isArray(r.images)) r.images = r.images.map(normalizeImageUrl).filter(Boolean);
    }

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
 * - section=all_items => 실제 가게 목록 + images[]
 * - 그 외 section => admin_ad_slots position prefix 방식
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

    // ✅ 1) all_items는 실제 가게 목록 + images[]
    if (section === "all_items") {
      const { selectSql: imgSelectSql, joinSql: imgJoinSql } = await buildImagesLateralJoin("s");

      const where = [];
      const params = [];
      let i = 1;

      if (category) {
        where.push(
          `btrim(replace(s.${STORE_MAP.category}::text, chr(160), ' ')) = btrim(replace($${i++}::text, chr(160), ' '))`
        );
        params.push(category);
      }

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

      for (const r of rows) {
        r.image_url = normalizeImageUrl(r.image_url);
        if (Array.isArray(r.images)) r.images = r.images.map(normalizeImageUrl).filter(Boolean);
      }

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

    // ✅ 2) 나머지 섹션은 admin_ad_slots (기존 방식)
    const cols = await getSlotsColumns();

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
    const category = clean(req.query.category);
    const subcategory = clean(req.query.subcategory);
    const idx = Math.max(safeInt(req.query.idx, 1), 1);

    if (!section) return res.status(400).json({ success: false, error: "section is required" });
    if (!hasCol(cols, "position")) {
      return res.status(500).json({ success: false, error: "admin_ad_slots.position column missing" });
    }

    const position = buildPosition({ mode: "food", category, subcategory, section, idx });

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
    if (slot && slot.image_url) slot.image_url = normalizeImageUrl(slot.image_url);

    return res.json({ success: true, mode: "food", page, position, slot });
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
    const category = clean(req.body.category);
    const subcategory = clean(req.body.subcategory);
    const idx = Math.max(safeInt(req.body.idx, 1), 1);

    if (!section) return res.status(400).json({ success: false, error: "section is required" });
    if (!hasCol(cols, "position")) {
      return res.status(500).json({ success: false, error: "admin_ad_slots.position column missing" });
    }

    const position = buildPosition({ mode: "food", category, subcategory, section, idx });

    const uploadedImageUrl = safePublicImageUrl(req.file);
    const bodyImageUrl = clean(req.body.image_url);
    const imageUrl = normalizeImageUrl(uploadedImageUrl || bodyImageUrl);

    const slotType = clean(req.body.slot_type || req.body.slotType);
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
    const category = clean(req.query.category);
    const subcategory = clean(req.query.subcategory);
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
