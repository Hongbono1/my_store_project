import fs from "fs";
import path from "path";
import crypto from "crypto";
import pool from "../db.js";

// 업로드 경로(다른 매니저와 동일)
export const UPLOAD_SUBDIR = "manager_ad";
export const UPLOAD_ABS_DIR = path.join("/data/uploads", UPLOAD_SUBDIR);
export const UPLOAD_PUBLIC_PREFIX = `/uploads/${UPLOAD_SUBDIR}`;

// 슬롯 테이블(기존 재사용)
const SLOTS_TABLE = "public.admin_ad_slots";

// combined 테이블(확정)
const COMBINED_TABLE = "public.combined_store_info";

// food 후보 테이블(존재하는 것 중 첫 번째 사용)
const FOOD_TABLE_CANDIDATES = [
  "public.store_info",
  "public.food_stores",
  "public.food_store_info",
  "public.food_store",
];

function ensureUploadDir() {
  fs.mkdirSync(UPLOAD_ABS_DIR, { recursive: true });
}

// ✅ mode별 테이블/컬럼 매핑 헬퍼 (필수)
function getStoreSource(mode) {
  const m = String(mode || "food").trim().toLowerCase();
  if (m === "combined") {
    return {
      table: "public.combined_store_info",
      subcol: "business_subcategory", // ✅ 여기로
      idcol: "id",
      bno: "business_number",
      bname: "business_name",
      bcat: "business_category",
      btype: "business_type",
      img: "main_image_url",
    };
  }
  return {
    table: "public.store_info",
    subcol: "detail_category", // ✅ 푸드 하위카테고리 (수정됨)
    idcol: "id",
    bno: "business_number",
    bname: "business_name",
    bcat: "business_category",
    btype: "business_type",
    img: "main_image_url",
  };
}

function clean(v) {
  if (v === undefined || v === null) return "";
  return String(v).trim();
}

function digitsOnly(v) {
  return clean(v).replace(/[^\d]/g, "");
}

function safeInt(v, def = 0) {
  const n = Number(String(v ?? "").replace(/[^\d-]/g, ""));
  return Number.isFinite(n) ? n : def;
}

function safeIntOrNull(v) {
  const s = clean(v);
  if (!s) return null;
  const n = Number(s.replace(/[^\d-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function toBool(v) {
  const s = String(v ?? "").toLowerCase();
  return s === "1" || s === "true" || s === "y" || s === "yes" || s === "on";
}

function parseDateTimeLocalToTs(v) {
  const s = clean(v);
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function makeMulterStorage() {
  return {
    destination(_req, _file, cb) {
      try {
        ensureUploadDir();
        cb(null, UPLOAD_ABS_DIR);
      } catch (e) {
        cb(e);
      }
    },
    filename(_req, file, cb) {
      const ext = path.extname(file.originalname || "").toLowerCase() || ".png";
      const name = `${crypto.randomUUID()}${ext}`;
      cb(null, name);
    },
  };
}

export function fileFilter(_req, file, cb) {
  const ok = /^image\/(png|jpeg|jpg|webp|gif)$/i.test(file.mimetype || "");
  if (!ok) return cb(new Error("이미지 파일만 업로드 가능합니다."));
  cb(null, true);
}

// ------------------------------
// ✅ 스키마 유틸 (동적 컬럼 매핑)
// ------------------------------
const columnsCache = new Map(); // key=tableName, value=Set(columns)

async function getColumns(tableFullName) {
  if (columnsCache.has(tableFullName)) return columnsCache.get(tableFullName);

  const [schema, table] = tableFullName.includes(".")
    ? tableFullName.split(".")
    : ["public", tableFullName];

  const q = `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema=$1 AND table_name=$2
  `;
  const { rows } = await pool.query(q, [schema, table]);
  const set = new Set(rows.map((r) => r.column_name));
  columnsCache.set(tableFullName, set);
  return set;
}

async function tableExists(tableFullName) {
  const [schema, table] = tableFullName.includes(".")
    ? tableFullName.split(".")
    : ["public", tableFullName];

  const q = `
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema=$1 AND table_name=$2
    LIMIT 1
  `;
  const { rows } = await pool.query(q, [schema, table]);
  return rows.length > 0;
}

async function pickFoodTable() {
  for (const t of FOOD_TABLE_CANDIDATES) {
    // eslint-disable-next-line no-await-in-loop
    if (await tableExists(t)) return t;
  }
  return null;
}

function pickCol(cols, candidates) {
  for (const c of candidates) {
    if (cols.has(c)) return c;
  }
  return null;
}

function buildStoreSelect(tableFullName, cols) {
  const idCol = pickCol(cols, ["id"]);
  const bnCol = pickCol(cols, [
    "business_number",
    "business_no",
    "biz_no",
    "biz_number",
  ]);
  const nameCol = pickCol(cols, ["business_name", "store_name", "name"]);
  const typeCol = pickCol(cols, ["business_type", "store_type", "type"]);
  const catCol = pickCol(cols, ["business_category", "category"]);
  const subCol = pickCol(cols, [
    "business_subcategory",
    "detail_category",
    "subcategory",
    "sub_category",
  ]);
  const createdCol = pickCol(cols, ["created_at", "createdat", "created"]);
  const viewsCol = pickCol(cols, ["view_count", "views", "viewcount"]);
  const imgCol = pickCol(cols, [
    "main_image_url",
    "image_url",
    "image1",
    "thumbnail_url",
  ]);

  if (!idCol || !nameCol) {
    throw new Error(
      `스토어 테이블(${tableFullName})에서 id/name 컬럼을 찾지 못했습니다.`
    );
  }

  return {
    idCol,
    bnCol,
    nameCol,
    typeCol,
    catCol,
    subCol,
    createdCol,
    viewsCol,
    imgCol,
  };
}

function buildOrderBy(sort, sel) {
  if (sort === "newest" && sel.createdCol) {
    return `"${sel.createdCol}" DESC NULLS LAST, "${sel.idCol}" DESC`;
  }
  if (sort === "views" && sel.viewsCol) {
    return `"${sel.viewsCol}" DESC NULLS LAST, "${sel.idCol}" DESC`;
  }
  return `"${sel.nameCol}" ASC NULLS LAST, "${sel.idCol}" ASC`;
}

function buildFilterWhere(params, sel, values) {
  const where = [];
  const category = clean(params.category);
  const subcategory = clean(params.subcategory);

  if (category && sel.catCol) {
    values.push(category);
    where.push(`"${sel.catCol}" = $${values.length}`);
  }
  if (subcategory && sel.subCol) {
    values.push(subcategory);
    where.push(`"${sel.subCol}" = $${values.length}`);
  }

  const qRaw = clean(params.q);
  if (qRaw) {
    const qDigits = digitsOnly(qRaw);
    const parts = [];

    if (qDigits && sel.bnCol) {
      values.push(qDigits);
      parts.push(`
        (
          regexp_replace("${sel.bnCol}"::text, '\\\\D', '', 'g') = $${values.length}
          OR ltrim(regexp_replace("${sel.bnCol}"::text, '\\\\D', '', 'g'), '0') = ltrim($${values.length}, '0')
        )
      `);

      values.push(`%${qDigits}%`);
      parts.push(
        `regexp_replace("${sel.bnCol}"::text, '\\\\D', '', 'g') LIKE $${values.length}`
      );
    }

    values.push(`%${qRaw}%`);
    parts.push(`"${sel.nameCol}"::text ILIKE $${values.length}`);

    if (sel.typeCol) {
      values.push(`%${qRaw}%`);
      parts.push(`"${sel.typeCol}"::text ILIKE $${values.length}`);
    }

    if (parts.length) where.push(`(${parts.join(" OR ")})`);
  }

  return where.length ? `WHERE ${where.join(" AND ")}` : "";
}

// ------------------------------
// ✅ 대표 이미지 1장 추출 (mode별 이미지 테이블)
// ------------------------------
const IMG_URL_COLS = [
  "image_url",
  "url",
  "path",
  "image_path",
  "file_url",
  "file_path",
];
const IMG_FK_COLS = [
  "store_id",
  "store_info_id",
  "storeinfo_id",
  "food_store_id",
  "combined_store_id",
  "parent_id",
  "ref_store_id",
];
const IMG_ORDER_COLS = ["sort_order", "priority", "idx", "created_at", "id"];

const imageMetaCache = new Map(); // key: mode|tableName -> meta

async function pickImageMetaForMode(mode) {
  const m = clean(mode) || "combined";

  const candidates =
    m === "combined"
      ? [
          "public.combined_store_images",
          "public.store_images",
          "public.food_store_images",
        ]
      : [
          "public.store_images",
          "public.food_store_images",
          "public.combined_store_images",
        ];

  for (const t of candidates) {
    const cacheKey = `${m}|${t}`;
    if (imageMetaCache.has(cacheKey)) return imageMetaCache.get(cacheKey);

    // eslint-disable-next-line no-await-in-loop
    if (!(await tableExists(t))) continue;

    // eslint-disable-next-line no-await-in-loop
    const cols = await getColumns(t);

    const fkCol = pickCol(cols, IMG_FK_COLS);
    const urlCol = pickCol(cols, IMG_URL_COLS);
    const orderCol = pickCol(cols, IMG_ORDER_COLS);

    if (fkCol && urlCol) {
      const meta = { table: t, fkCol, urlCol, orderCol };
      imageMetaCache.set(cacheKey, meta);
      return meta;
    }
  }
  return null;
}

function buildImageSubquery(selIdCol, meta) {
  if (!meta) return "NULL";
  const order = meta.orderCol
    ? `"${meta.orderCol}" ASC NULLS LAST`
    : `"${meta.urlCol}" ASC NULLS LAST`;

  return `
    (
      SELECT NULLIF("${meta.urlCol}"::text,'')
      FROM ${meta.table}
      WHERE "${meta.fkCol}"::text = "${selIdCol}"::text
      ORDER BY ${order}
      LIMIT 1
    )
  `;
}

// ------------------------------
// ✅ GET /stores
// ------------------------------
export async function listStores(req, res) {
  try {
    const mode = clean(req.query.mode) || "food";
    const category = clean(req.query.category);
    const subcategory = clean(req.query.subcategory);
    const pageSize = Math.min(Math.max(safeInt(req.query.pageSize, 12), 1), 50);
    const page = Math.max(safeInt(req.query.page, 1), 1);

    const src = getStoreSource(mode);

    const params = [];
    let where = "WHERE 1=1";

    if (category) {
      params.push(category);
      where += ` AND s.${src.bcat} = $${params.length}`;
    }
    if (subcategory) {
      params.push(subcategory);
      where += ` AND COALESCE(s.${src.subcol}, '') = $${params.length}`;
    }

    const offset = (page - 1) * pageSize;

    const countSql = `SELECT COUNT(*)::int AS cnt FROM ${src.table} s ${where}`;
    const { rows: crows } = await pool.query(countSql, params);
    const total = crows[0]?.cnt || 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    const selectSql = `
      SELECT
        s.${src.idcol}::text AS id,
        s.${src.bno}::text AS business_number,
        s.${src.bname}::text AS business_name,
        COALESCE(s.${src.btype}, '')::text AS business_type,
        COALESCE(s.${src.bcat}, '')::text AS business_category,
        COALESCE(s.${src.subcol}, '')::text AS subcategory,
        COALESCE(
          (SELECT si.url FROM store_images si WHERE si.store_id = s.${src.idcol} ORDER BY si.sort_order LIMIT 1),
          ''
        )::text AS image_url
      FROM ${src.table} s
      ${where}
      ORDER BY s.${src.idcol} DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `;

    const { rows } = await pool.query(selectSql, params);

    return res.json({
      success: true,
      mode,
      category,
      subcategory,
      page,
      pageSize,
      total,
      totalPages,
      stores: rows,
    });
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, error: err?.message || "listStores 실패" });
  }
}

// ------------------------------
// ✅ GET /search  (+ /search-store alias는 router에서 처리)
// ------------------------------
export async function searchStore(req, res) {
  try {
    const mode = clean(req.query.mode) || "food";
    const qRaw = clean(req.query.q) || "__all__";
    const pageSize = Math.min(Math.max(safeInt(req.query.pageSize, 12), 1), 200);

    const isAll = qRaw === "__all__" || qRaw === "";
    const qDigits = digitsOnly(qRaw);

    const src = getStoreSource(mode);

    const params = [];
    const whereParts = [];

    if (!isAll) {
      if (qDigits) {
        params.push(qDigits);
        whereParts.push(`
          regexp_replace(s.${src.bno}::text, '\\\\D', '', 'g') = $${params.length}
        `);

        params.push(`%${qDigits}%`);
        whereParts.push(
          `regexp_replace(s.${src.bno}::text, '\\\\D', '', 'g') LIKE $${params.length}`
        );
      }

      params.push(`%${qRaw}%`);
      whereParts.push(`s.${src.bname}::text ILIKE $${params.length}`);

      params.push(`%${qRaw}%`);
      whereParts.push(`s.${src.btype}::text ILIKE $${params.length}`);
    }

    const where = whereParts.length ? `WHERE (${whereParts.join(" OR ")})` : "";
    const orderBy = `s.${src.bname} ASC NULLS LAST, s.${src.idcol} ASC`;

    const sql = `
      WITH base AS (
        SELECT
          s.${src.idcol}::text AS id,
          s.${src.bno}::text AS business_number,
          s.${src.bname}::text AS business_name,
          COALESCE(s.${src.btype}, '')::text AS business_type,
          COALESCE(
            (SELECT si.url FROM store_images si WHERE si.store_id = s.${src.idcol} ORDER BY si.sort_order LIMIT 1),
            ''
          )::text AS image_url,
          ROW_NUMBER() OVER (ORDER BY ${orderBy}) AS rn
        FROM ${src.table} s
        ${where}
      )
      SELECT
        id, business_number, business_name, business_type, image_url,
        ( (rn - 1) / 12 )::int + 1 AS page_number,
        ( (rn - 1) % 12 )::int + 1 AS index_in_page,
        rn::text AS rn
      FROM base
      ORDER BY rn
      LIMIT $${params.length + 1};
    `;

    params.push(pageSize);

    console.log("[searchStore] SQL:", sql);
    console.log("[searchStore] Params:", params);

    const { rows } = await pool.query(sql, params);
    console.log("[searchStore] Results count:", rows.length);
    return res.json({ success: true, mode, q: qRaw, results: rows });
  } catch (e) {
    console.error("[searchStore ERROR]", e);
    console.error("[searchStore] mode:", req.query.mode);
    console.error("[searchStore] q:", req.query.q);
    return res
      .status(500)
      .json({ success: false, error: e?.message || "searchStore 실패" });
  }
}

// ------------------------------
// ✅ 슬롯 테이블 컬럼 매핑(동적)
// ------------------------------
let slotsColsCached = null;
async function getSlotCols() {
  if (slotsColsCached) return slotsColsCached;
  const cols = await getColumns(SLOTS_TABLE);
  slotsColsCached = cols;
  return cols;
}

function pickSlotCol(cols, candidates) {
  for (const c of candidates) if (cols.has(c)) return c;
  return null;
}

function buildSlotColumnMap(cols) {
  return {
    page: pickSlotCol(cols, ["page"]),
    position: pickSlotCol(cols, ["position"]),
    priority: pickSlotCol(cols, ["priority", "slot_priority", "sort_order", "rank"]),
    slotType: pickSlotCol(cols, ["slot_type", "type"]),
    slotMode: pickSlotCol(cols, ["slot_mode", "mode"]),
    linkUrl: pickSlotCol(cols, ["link_url", "url"]),
    imageUrl: pickSlotCol(cols, ["image_url", "image_path", "image"]),
    // ✅ 네 스키마에 맞춤: text_content
    textContent: pickSlotCol(cols, ["text_content", "text_desc", "text", "content", "description", "text_title", "title"]),
    storeId: pickSlotCol(cols, ["store_id"]),
    storeBiz: pickSlotCol(cols, [
      "business_no", // ✅ 실제 컬럼(네온 admin_ad_slots)
      "business_number",
      "store_business_no",
    ]),
    storeName: pickSlotCol(cols, ["business_name", "store_name"]),
    storeType: pickSlotCol(cols, ["store_type", "business_type"]),
    tableSource: pickSlotCol(cols, ["table_source", "source_table"]),
    noEnd: pickSlotCol(cols, ["no_end", "noend"]),
    startAt: pickSlotCol(cols, ["start_at", "start_datetime"]),
    endAt: pickSlotCol(cols, ["end_at", "end_datetime"]),
    startDate: pickSlotCol(cols, ["start_date"]),
    endDate: pickSlotCol(cols, ["end_date"]),
    updatedAt: pickSlotCol(cols, ["updated_at"]),
    createdAt: pickSlotCol(cols, ["created_at"]),
  };
}

// DB 제약: slot_type IN ('banner','text')
function mapSlotType(adMode) {
  const m = clean(adMode).toLowerCase();
  if (m === "text") return "text";
  return "banner";
}

function inferTableSourceFromPosition(position) {
  const p = clean(position);
  if (p.endsWith("__combined")) return "combined_store_info";
  if (p.endsWith("__food")) return "food";
  return "";
}

// ------------------------------
// ✅ GET /slot
// ------------------------------
export async function getSlot(req, res) {
  try {
    const cols = await getSlotCols();
    const m = buildSlotColumnMap(cols);

    if (!m.page || !m.position || !m.priority) {
      return res.status(500).json({
        success: false,
        error: "admin_ad_slots에 page/position/priority 컬럼이 필요합니다.",
      });
    }

    const page = clean(req.query.page);
    const position = clean(req.query.position);
    const priority = safeIntOrNull(req.query.priority);

    if (!page || !position || priority === null) {
      return res.status(400).json({ success: false, error: "page/position/priority 필요" });
    }

    const sql = `
      SELECT *
      FROM ${SLOTS_TABLE}
      WHERE "${m.page}"=$1 AND "${m.position}"=$2 AND "${m.priority}"=$3
      LIMIT 1
    `;
    const { rows } = await pool.query(sql, [page, position, priority]);
    return res.json({ success: true, slot: rows[0] || null });
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, error: err?.message || "getSlot 실패" });
  }
}

// ------------------------------
// ✅ GET /candidates (priority 1~6)
// ------------------------------
export async function listCandidates(req, res) {
  try {
    const cols = await getSlotCols();
    const m = buildSlotColumnMap(cols);

    const page = clean(req.query.page);
    const position = clean(req.query.position);
    if (!page || !position) {
      return res.status(400).json({ success: false, error: "page/position 필요" });
    }
    if (!m.page || !m.position || !m.priority) {
      return res.status(500).json({
        success: false,
        error: "admin_ad_slots에 page/position/priority 컬럼이 필요합니다.",
      });
    }

    const sql = `
      SELECT *
      FROM ${SLOTS_TABLE}
      WHERE "${m.page}"=$1 AND "${m.position}"=$2
        AND "${m.priority}" BETWEEN 1 AND 6
      ORDER BY "${m.priority}" ASC
    `;
    const { rows } = await pool.query(sql, [page, position]);
    return res.json({ success: true, items: rows });
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, error: err?.message || "listCandidates 실패" });
  }
}

// ------------------------------
// ✅ DELETE /delete
// ------------------------------
export async function deleteSlot(req, res) {
  try {
    const cols = await getSlotCols();
    const m = buildSlotColumnMap(cols);

    const page = clean(req.query.page);
    const position = clean(req.query.position);
    const priority = safeIntOrNull(req.query.priority);

    if (!page || !position || priority === null) {
      return res.status(400).json({ success: false, error: "page/position/priority 필요" });
    }
    if (!m.page || !m.position || !m.priority) {
      return res.status(500).json({
        success: false,
        error: "admin_ad_slots에 page/position/priority 컬럼이 필요합니다.",
      });
    }

    const sql = `
      DELETE FROM ${SLOTS_TABLE}
      WHERE "${m.page}"=$1 AND "${m.position}"=$2 AND "${m.priority}"=$3
      RETURNING *
    `;
    const del = await pool.query(sql, [page, position, priority]);

    return res.json({ success: true, deleted: del.rowCount });
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, error: err?.message || "deleteSlot 실패" });
  }
}

// ------------------------------
// ✅ POST /update (multipart: image optional)
// ------------------------------
export async function upsertSlot(req, res) {
  try {
    const cols = await getSlotCols();
    const m = buildSlotColumnMap(cols);

    if (!m.page || !m.position || !m.priority) {
      return res.status(500).json({
        success: false,
        error: "admin_ad_slots에 page/position/priority 컬럼이 필요합니다.",
      });
    }

    const page = clean(req.body.page);
    const position = clean(req.body.position);
    const priority = Math.max(safeInt(req.body.priority, safeInt(req.body.idx, 1)), 1);

    if (!page || !position || !priority) {
      return res.status(400).json({ success: false, error: "page/position/priority 필요" });
    }

    const adMode = clean(req.body.adMode || req.body.slot_type || "banner");
    const slot_type = mapSlotType(adMode);
    const slot_mode = clean(req.body.slotMode || req.body.slot_mode || "store");

    const linkUrl = clean(req.body.linkUrl || req.body.link_url);

    // ✅ text_content로 통일 (기존 필드 호환)
    const textContent = clean(
      req.body.textContent ||
        req.body.text_content ||
        req.body.textDesc ||
        req.body.desc ||
        req.body.description ||
        req.body.textTitle ||
        req.body.title ||
        req.body.text_title
    );

    const noEnd = toBool(req.body.noEnd);
    const startAt = parseDateTimeLocalToTs(req.body.startAt);
    const endAt = parseDateTimeLocalToTs(req.body.endAt);

    let imageUrl = "";
    if (req.file?.filename) imageUrl = `${UPLOAD_PUBLIC_PREFIX}/${req.file.filename}`;

    const storeId = safeIntOrNull(req.body.storeId || req.body.store_id);

    let storeBusinessNumber = clean(
      req.body.storeBusinessNumber ||
        req.body.business_no || // ✅ admin_ad_slots 실제 컬럼명
        req.body.business_number ||
        req.body.store_business_no
    );
    let storeName = clean(req.body.storeName || req.body.business_name || req.body.store_name);
    let storeType = clean(req.body.storeType || req.body.business_type || req.body.store_type);

    // store 모드 + storeId만 있어도 DB에서 자동 채움
    if (slot_mode === "store" && storeId !== null) {
      const tableSource2 = inferTableSourceFromPosition(position);
      const table =
        tableSource2 === "combined_store_info" ? COMBINED_TABLE : (await pickFoodTable()) || "public.store_info";

      if (table) {
        const tcols = await getColumns(table);
        const sel2 = buildStoreSelect(table, tcols);

        const mode2 = tableSource2 === "combined_store_info" ? "combined" : "food";
        const imgMeta2 = await pickImageMetaForMode(mode2);
        const imgSub2 = buildImageSubquery(sel2.idCol, imgMeta2);

        const imageExpr2 = sel2.imgCol
          ? `COALESCE(NULLIF("${sel2.imgCol}"::text,''), COALESCE(${imgSub2},''))`
          : `COALESCE(${imgSub2},'')`;

        const sql2 = `
          SELECT
            "${sel2.idCol}"::text AS id,
            ${sel2.bnCol ? `"${sel2.bnCol}"::text` : `''`} AS business_number,
            "${sel2.nameCol}"::text AS business_name,
            ${sel2.typeCol ? `COALESCE("${sel2.typeCol}"::text,'')` : `''`} AS business_type,
            ${imageExpr2} AS image_url
          FROM ${table}
          WHERE "${sel2.idCol}" = $1
          LIMIT 1
        `;
        const { rows: srows } = await pool.query(sql2, [storeId]);
        const s = srows[0];

        if (s) {
          if (!storeBusinessNumber) storeBusinessNumber = clean(s.business_number);
          if (!storeName) storeName = clean(s.business_name);
          if (!storeType) storeType = clean(s.business_type);
          if (!imageUrl) imageUrl = clean(s.image_url); // ✅ 업로드 없으면 자동
        }
      }
    }

    const tableSource = inferTableSourceFromPosition(position);

    const insertCols = [];
    const insertVals = [];
    const params = [];

    function add(colName, value) {
      if (!colName) return;
      insertCols.push(`"${colName}"`);
      params.push(value);
      insertVals.push(`$${params.length}`);
    }

    add(m.page, page);
    add(m.position, position);
    add(m.priority, priority);

    add(m.slotType, slot_type);
    add(m.slotMode, slot_mode);

    add(m.linkUrl, linkUrl);
    if (m.imageUrl) add(m.imageUrl, imageUrl);

    if (m.textContent) add(m.textContent, textContent);

    if (m.storeId && storeId !== null) add(m.storeId, storeId);
    if (m.storeBiz) add(m.storeBiz, storeBusinessNumber);
    if (m.storeName) add(m.storeName, storeName);
    if (m.storeType) add(m.storeType, storeType);

    if (m.tableSource && tableSource) add(m.tableSource, tableSource);

    if (m.noEnd) add(m.noEnd, noEnd);
    if (m.startAt) add(m.startAt, startAt);
    if (m.endAt) add(m.endAt, endAt);

    if (m.updatedAt) add(m.updatedAt, new Date().toISOString());

    const conflictTarget = `"${m.page}","${m.position}","${m.priority}"`;

    const updateSets = insertCols
      .filter((c) => ![`"${m.page}"`, `"${m.position}"`, `"${m.priority}"`].includes(c))
      .map((c) => `${c}=EXCLUDED.${c}`);

    const sqlUpsert = `
      INSERT INTO ${SLOTS_TABLE} (${insertCols.join(",")})
      VALUES (${insertVals.join(",")})
      ON CONFLICT (${conflictTarget})
      DO UPDATE SET ${
        updateSets.length ? updateSets.join(",") : `"${m.page}"=EXCLUDED."${m.page}"`
      }
      RETURNING *
    `;

    try {
      const { rows } = await pool.query(sqlUpsert, params);
      return res.json({ success: true, slot: rows[0] });
    } catch (e) {
      const code = e?.code;
      if (code !== "42P10") throw e;

      // unique index/constraint 없음(42P10) fallback
      const delSql = `
        DELETE FROM ${SLOTS_TABLE}
        WHERE "${m.page}"=$1 AND "${m.position}"=$2 AND "${m.priority}"=$3
      `;
      await pool.query(delSql, [page, position, priority]);

      const insSql = `
        INSERT INTO ${SLOTS_TABLE} (${insertCols.join(",")})
        VALUES (${insertVals.join(",")})
        RETURNING *
      `;
      const { rows } = await pool.query(insSql, params);
      return res.json({ success: true, slot: rows[0], note: "fallback-insert" });
    }
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, error: err?.message || "upsertSlot 실패" });
  }
}

// ------------------------------
// ✅ GET /grid (12칸)
// ✅ 핵심: 자동배치 12개 + admin_ad_slots(저장된 칸) 오버라이드 덮어쓰기
// ------------------------------
function buildAutoOrderBy(section, sel) {
  const s = clean(section).toLowerCase();

  // ✅ newly 별칭 지원
  if ((s === "new_registration" || s === "newly" || s === "new") && sel.createdCol) {
    return `"${sel.createdCol}" DESC NULLS LAST, "${sel.idCol}" DESC`;
  }

  // ✅ best 별칭 지원
  if ((s === "best_seller" || s === "best") && sel.viewsCol) {
    return `"${sel.viewsCol}" DESC NULLS LAST, "${sel.idCol}" DESC`;
  }

  // all_items 기본
  return `"${sel.idCol}" DESC`;
}

export async function getGrid(req, res) {
  try {
    const cols = await getSlotCols();
    const m = buildSlotColumnMap(cols);

    if (!m.page || !m.position) {
      return res.status(500).json({
        success: false,
        error: "admin_ad_slots에 page/position 컬럼이 필요합니다.",
      });
    }

    const page = clean(req.query.page);
    const section = clean(req.query.section) || "all_items";
    const mode = clean(req.query.mode) || "food";
    const pageNo = Math.max(safeInt(req.query.pageNo, 1), 1);

    const category = clean(req.query.category);
    const subcategory = clean(req.query.subcategory);

    if (!page) return res.status(400).json({ success: false, error: "page 필요" });

    const suffix = mode === "food" ? "__food" : "__combined";
    const like = `${section}__p${pageNo}__b%${suffix}`;

    // --------------------------
    // 0) 스토어 테이블 선택(자동배치용)
    // --------------------------
    const storeTable =
      mode === "combined" ? COMBINED_TABLE : (await pickFoodTable()) || "public.store_info";
    const tcols = await getColumns(storeTable);
    const sel = buildStoreSelect(storeTable, tcols);

    // 대표 이미지(스토어 테이블 imgCol or 이미지 테이블 subquery)
    const imgMeta = await pickImageMetaForMode(mode);
    const imgSub = buildImageSubquery(sel.idCol, imgMeta);
    const imageExpr = sel.imgCol
      ? `COALESCE(NULLIF("${sel.imgCol}"::text,''), COALESCE(${imgSub},''))`
      : `COALESCE(${imgSub},'')`;

    // --------------------------
    // 1) 오버라이드 슬롯 조회(저장된 칸)
    //    ✅ position LIKE만으로 조회 (category/subcategory 필터는 auto 배치에만 적용)
    // --------------------------
    const paramsSlots = [page, like];

    const posCol = m.position;
    const priCol = m.priority;
    const slotTypeCol = m.slotType;
    const slotModeCol = m.slotMode;
    const storeIdCol = m.storeId;
    const storeBizCol = m.storeBiz;
    const storeNameCol = m.storeName;
    const storeTypeCol = m.storeType;
    const imageUrlCol = m.imageUrl;
    const textContentCol = m.textContent;
    const updatedAtCol = m.updatedAt;

    const slotSql = `
      SELECT DISTINCT ON (slots."${posCol}")
        slots."${posCol}"::text AS position,
        ${priCol ? `slots."${priCol}"::int` : `1`} AS priority,
        ${slotTypeCol ? `COALESCE(slots."${slotTypeCol}"::text,'')` : `''`} AS slot_type,
        ${slotModeCol ? `COALESCE(slots."${slotModeCol}"::text,'')` : `''`} AS slot_mode,
        ${storeIdCol ? `slots."${storeIdCol}"` : `NULL`} AS store_id,
        ${storeBizCol ? `COALESCE(slots."${storeBizCol}"::text,'')` : `''`} AS business_no,
        ${storeNameCol ? `COALESCE(slots."${storeNameCol}"::text,'')` : `''`} AS business_name,
        ${storeTypeCol ? `COALESCE(slots."${storeTypeCol}"::text,'')` : `''`} AS store_type,
        ${imageUrlCol ? `COALESCE(slots."${imageUrlCol}"::text,'')` : `''`} AS image_url,
        ${textContentCol ? `COALESCE(slots."${textContentCol}"::text,'')` : `''`} AS text_content,
        ${updatedAtCol ? `slots."${updatedAtCol}"` : `NULL`} AS updated_at
      FROM ${SLOTS_TABLE} slots
      WHERE slots."${m.page}"=$1
        AND slots."${posCol}" LIKE $2
      ${priCol ? `ORDER BY slots."${posCol}" ASC, slots."${priCol}" ASC` : `ORDER BY slots."${posCol}" ASC`}
    `;

    const { rows: slotRows } = await pool.query(slotSql, paramsSlots);

    const overrideMap = new Map(); // boxNo -> row
    for (const r of slotRows) {
      const pos = String(r.position || "");
      const mm = pos.match(/__b(\d+)__/);
      if (!mm) continue;
      const boxNo = Number(mm[1]);
      if (!Number.isFinite(boxNo)) continue;
      overrideMap.set(boxNo, r);
    }

    // --------------------------
    // 2) 자동배치 12개 계산(스토어 테이블에서 row_number)
    // --------------------------
    const values = [];
    const whereParts = [];

    if (category && sel.catCol) {
      values.push(category);
      whereParts.push(`"${sel.catCol}" = $${values.length}`);
    }
    if (subcategory && sel.subCol) {
      values.push(subcategory);
      whereParts.push(`COALESCE("${sel.subCol}"::text,'') = $${values.length}`);
    }

    const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

    // ✅ 전체 건수/총페이지 계산 (12칸 기준)
    const countSql = `SELECT COUNT(*)::int AS cnt FROM ${storeTable} ${whereSql}`;
    const { rows: cntRows } = await pool.query(countSql, values.slice(0, whereParts.length));
    const total = cntRows?.[0]?.cnt ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / 12));
    const hasPrev = pageNo > 1;
    const hasNext = pageNo < totalPages;

    const orderBy = buildAutoOrderBy(section, sel);

    const startRn = (pageNo - 1) * 12 + 1;
    const endRn = pageNo * 12;

    values.push(startRn);
    const pStart = values.length;
    values.push(endRn);
    const pEnd = values.length;

    const autoSql = `
      WITH ranked AS (
        SELECT
          "${sel.idCol}"::text AS id,
          ${sel.bnCol ? `"${sel.bnCol}"::text` : `''`} AS business_no,
          "${sel.nameCol}"::text AS business_name,
          ${sel.typeCol ? `COALESCE("${sel.typeCol}"::text,'')` : `''`} AS store_type,
          ${imageExpr} AS image_url,
          ROW_NUMBER() OVER (ORDER BY ${orderBy}) AS rn
        FROM ${storeTable}
        ${whereSql}
      )
      SELECT *
      FROM ranked
      WHERE rn BETWEEN $${pStart} AND $${pEnd}
      ORDER BY rn ASC
    `;

    const { rows: autoRows } = await pool.query(autoSql, values);

    const autoMap = new Map(); // boxNo -> autoRow
    for (let i = 0; i < autoRows.length; i += 1) {
      autoMap.set(i + 1, autoRows[i]);
    }

    // --------------------------
    // 3) 12칸 합성(override 우선)
    // --------------------------
    const items = [];
    for (let b = 1; b <= 12; b += 1) {
      const position = `${section}__p${pageNo}__b${b}${suffix}`;

      const over = overrideMap.get(b);
      const auto = autoMap.get(b);

      if (over) {
        items.push({
          boxNo: b,
          position,
          occupied: true,
          source: "override",
          priority: over.priority ?? null,
          slot_type: over.slot_type ?? "",
          slot_mode: over.slot_mode ?? "",
          store_id: over.store_id ?? null,
          business_no: over.business_no ?? "",
          business_name: over.business_name ?? "",
          store_type: over.store_type ?? "",
          image_url: over.image_url ?? "",
          text_content: over.text_content ?? "",
          label: over.business_name || over.text_content || "",
          updated_at: over.updated_at ?? null,
        });
        continue;
      }

      if (auto) {
        items.push({
          boxNo: b,
          position,
          occupied: true,
          source: "auto",
          priority: null,
          slot_type: "banner",
          slot_mode: "store",
          store_id: auto.id ? safeIntOrNull(auto.id) : null,
          business_no: auto.business_no ?? "",
          business_name: auto.business_name ?? "",
          store_type: auto.store_type ?? "",
          image_url: auto.image_url ?? "",
          text_content: "",
          label: auto.business_name ?? "",
          updated_at: null,
        });
        continue;
      }

      items.push({
        boxNo: b,
        position,
        occupied: false,
        source: "empty",
        priority: null,
        slot_type: "",
        slot_mode: "",
        store_id: null,
        business_no: "",
        business_name: "",
        store_type: "",
        image_url: "",
        text_content: "",
        label: "",
        updated_at: null,
      });
    }

    return res.json({
      success: true,
      page: clean(page),
      section: clean(section),
      mode: clean(mode),
      pageNo,
      category: clean(category),
      subcategory: clean(subcategory),
      total,
      totalPages,
      hasPrev,
      hasNext,
      items,
    });
  } catch (err) {
    console.error("[getGrid ERROR]", err);
    return res
      .status(500)
      .json({ success: false, error: err?.message || "getGrid 실패" });
  }
}

// ------------------------------
// ✅ GET /where (사업자번호로 admin_ad_slots 역검색)
// ------------------------------
function parsePosition(position) {
  const p = clean(position);
  const m = p.match(/^([a-z_]+)__p(\d+)__b(\d+)(?:__(food|combined))?$/i);
  if (!m) return { raw: p, section: "", page_number: null, index_in_page: null, mode: "" };

  const section = (m[1] || "").toLowerCase();
  const page_number = Number(m[2] || 0) || null;
  const index_in_page = Number(m[3] || 0) || null;
  const mode = (m[4] || "").toLowerCase();

  const labelMap = {
    all_items: "All items",
    best_seller: "Best Seller",
    new_registration: "New registration",
  };

  return {
    raw: p,
    section,
    section_label: labelMap[section] || section,
    page_number,
    index_in_page,
    mode,
  };
}

export async function whereStore(req, res) {
  try {
    const cols = await getSlotCols();
    const m = buildSlotColumnMap(cols);

    if (!m.storeBiz || !m.position || !m.page || !m.priority) {
      return res.status(500).json({
        success: false,
        error:
          "admin_ad_slots에 business_no(또는 business_number) / page / position / priority 컬럼이 필요합니다.",
      });
    }

    const qRaw = clean(req.query.q || req.query.business_number || "");
    const biz = digitsOnly(qRaw);
    if (!biz) return res.status(400).json({ success: false, error: "q(사업자번호)가 필요합니다." });

    const page = clean(req.query.page || "subcategory"); // subcategory | all
    const limit = Math.min(Math.max(safeInt(req.query.limit, 50), 1), 200);

    const params = [biz];
    let where = `
      (
        regexp_replace(COALESCE("${m.storeBiz}"::text,''), '\\\\D', '', 'g') = $1
        OR ltrim(regexp_replace(COALESCE("${m.storeBiz}"::text,''), '\\\\D', '', 'g'), '0') = ltrim($1, '0')
      )
    `;

    if (page && page !== "all") {
      params.push(page);
      where += ` AND "${m.page}" = $${params.length}`;
    }

    params.push(limit);

    const sql = `
      SELECT *
      FROM ${SLOTS_TABLE}
      WHERE ${where}
      ORDER BY "${m.page}" ASC, "${m.position}" ASC, "${m.priority}" ASC
      LIMIT $${params.length}
    `;

    const { rows } = await pool.query(sql, params);

    const items = (rows || []).map((r) => {
      const pos = parsePosition(r?.[m.position]);
      return {
        page: r?.[m.page],
        priority: r?.[m.priority],
        position: r?.[m.position],
        parsed: pos,
        row: r,
      };
    });

    return res.json({
      success: true,
      q: biz,
      pageFilter: page,
      count: items.length,
      items,
    });
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, error: err?.message || "whereStore 실패" });
  }
}
