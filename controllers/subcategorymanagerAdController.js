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
  "public.food_stores",
  "public.food_store_info",
  "public.food_store",
  "public.store_info",
];

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
  // datetime-local 은 "YYYY-MM-DDTHH:mm" 형태
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString(); // timestamptz로 넣어도 되고 timestamp로도 보통 들어감
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

// 컬럼 후보를 보고 실제 사용할 컬럼명을 선택
function pickCol(cols, candidates) {
  for (const c of candidates) {
    if (cols.has(c)) return c;
  }
  return null;
}

function buildStoreSelect(tableFullName, cols) {
  // 공통 컬럼명(여러 테이블 대응)
  const idCol = pickCol(cols, ["id"]);
  const bnCol = pickCol(cols, ["business_number", "business_no", "biz_no", "biz_number"]);
  const nameCol = pickCol(cols, ["business_name", "store_name", "name"]);
  const typeCol = pickCol(cols, ["business_type", "store_type", "type"]);
  const catCol = pickCol(cols, ["business_category", "category"]);
  const subCol = pickCol(cols, ["business_subcategory", "subcategory", "sub_category"]);
  const createdCol = pickCol(cols, ["created_at", "createdat", "created"]);
  const viewsCol = pickCol(cols, ["view_count", "views", "viewcount"]);
  const imgCol = pickCol(cols, ["main_image_url", "image_url", "image1", "thumbnail_url"]);

  const select = {
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

  // 최소 필수
  if (!idCol || !nameCol) {
    throw new Error(`스토어 테이블(${tableFullName})에서 id/name 컬럼을 찾지 못했습니다.`);
  }

  return select;
}

function buildOrderBy(sort, sel) {
  // sort: name | newest | views
  if (sort === "newest" && sel.createdCol) {
    return `"${sel.createdCol}" DESC NULLS LAST, "${sel.idCol}" DESC`;
  }
  if (sort === "views" && sel.viewsCol) {
    return `"${sel.viewsCol}" DESC NULLS LAST, "${sel.idCol}" DESC`;
  }
  // 기본: name
  return `"${sel.nameCol}" ASC NULLS LAST, "${sel.idCol}" ASC`;
}

function buildFilterWhere(params, sel, values) {
  // params: {category, subcategory, q}
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
      values.push(`%${qDigits}%`);
      parts.push(`"${sel.bnCol}"::text LIKE $${values.length}`);
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
// ✅ GET /admin/subcategory/stores
// ------------------------------
export async function listStores(req, res) {
  try {
    const mode = clean(req.query.mode) || "combined";
    const sort = clean(req.query.sort) || "name";
    const pageSize = Math.min(Math.max(safeInt(req.query.pageSize, 12), 1), 50);
    const page = Math.max(safeInt(req.query.page, 1), 1);

    const table =
      mode === "combined"
        ? COMBINED_TABLE
        : await pickFoodTable();

    if (!table) {
      return res.status(400).json({ success: false, error: "food 테이블을 찾지 못했습니다." });
    }

    const cols = await getColumns(table);
    const sel = buildStoreSelect(table, cols);

    const values = [];
    const where = buildFilterWhere(
      { category: req.query.category, subcategory: req.query.subcategory },
      sel,
      values
    );

    const orderBy = buildOrderBy(sort, sel);
    const offset = (page - 1) * pageSize;

    const countSql = `SELECT COUNT(*)::int AS cnt FROM ${table} ${where}`;
    const { rows: crows } = await pool.query(countSql, values);
    const total = crows[0]?.cnt || 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    const selectSql = `
      SELECT
        "${sel.idCol}"::text AS id,
        ${sel.bnCol ? `"${sel.bnCol}"::text` : "''"} AS business_number,
        "${sel.nameCol}"::text AS business_name,
        ${sel.typeCol ? `"${sel.typeCol}"::text` : "''"} AS business_type,
        ${sel.catCol ? `"${sel.catCol}"::text` : "''"} AS business_category,
        ${sel.subCol ? `"${sel.subCol}"::text` : "''"} AS business_subcategory,
        ${sel.imgCol ? `"${sel.imgCol}"::text` : "''"} AS image_url
      FROM ${table}
      ${where}
      ORDER BY ${orderBy}
      LIMIT ${pageSize} OFFSET ${offset}
    `;

    const { rows } = await pool.query(selectSql, values);

    return res.json({
      success: true,
      mode,
      page,
      pageSize,
      total,
      totalPages,
      stores: rows,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err?.message || "listStores 실패",
    });
  }
}

// ------------------------------
// ✅ GET /admin/subcategory/search
// 결과: page_number, index_in_page 포함
// ------------------------------
export async function searchStore(req, res) {
  try {
    const mode = clean(req.query.mode) || "combined";
    const sort = clean(req.query.sort) || "name";
    const q = clean(req.query.q);
    const pageSize = Math.min(Math.max(safeInt(req.query.pageSize, 12), 1), 50);

    if (!q) return res.json({ success: true, results: [] });

    const table =
      mode === "combined"
        ? COMBINED_TABLE
        : await pickFoodTable();

    if (!table) {
      return res.status(400).json({ success: false, error: "food 테이블을 찾지 못했습니다." });
    }

    const cols = await getColumns(table);
    const sel = buildStoreSelect(table, cols);

    const values = [];
    const where = buildFilterWhere(
      { category: req.query.category, subcategory: req.query.subcategory, q },
      sel,
      values
    );

    const orderBy = buildOrderBy(sort, sel);

    const sql = `
      WITH filtered AS (
        SELECT
          "${sel.idCol}"::text AS id,
          ${sel.bnCol ? `"${sel.bnCol}"::text` : "''"} AS business_number,
          "${sel.nameCol}"::text AS business_name,
          ${sel.typeCol ? `"${sel.typeCol}"::text` : "''"} AS business_type,
          ${sel.imgCol ? `"${sel.imgCol}"::text` : "''"} AS image_url,
          ROW_NUMBER() OVER (ORDER BY ${orderBy}) AS rn
        FROM ${table}
        ${where}
      )
      SELECT
        id, business_number, business_name, business_type, image_url, rn,
        CEIL(rn::numeric / ${pageSize})::int AS page_number,
        ((rn - 1) % ${pageSize} + 1)::int AS index_in_page
      FROM filtered
      ORDER BY rn
      LIMIT 200
    `;

    const { rows } = await pool.query(sql, values);
    return res.json({ success: true, mode, q, results: rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || "searchStore 실패" });
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
    textTitle: pickSlotCol(cols, ["text_title", "title", "text"]),
    storeId: pickSlotCol(cols, ["store_id"]),
    storeBiz: pickSlotCol(cols, ["store_business_number", "store_business_no", "business_number"]),
    storeName: pickSlotCol(cols, ["store_name", "business_name"]),
    storeType: pickSlotCol(cols, ["store_type", "business_type"]),
    storeImage: pickSlotCol(cols, ["store_image_url", "store_image", "store_img_url"]),
    noEnd: pickSlotCol(cols, ["no_end", "noend"]),
    startAt: pickSlotCol(cols, ["start_at", "start_date", "start_datetime"]),
    endAt: pickSlotCol(cols, ["end_at", "end_date", "end_datetime"]),
    updatedAt: pickSlotCol(cols, ["updated_at"]),
    createdAt: pickSlotCol(cols, ["created_at"]),
  };
}

function mapAdModeToSlot(adMode) {
  if (adMode === "store") return { slot_type: "image", slot_mode: "store" };
  if (adMode === "text") return { slot_type: "text", slot_mode: "text" };
  return { slot_type: "image", slot_mode: "custom" }; // image
}

// ------------------------------
// ✅ GET /admin/subcategory/slot
// ------------------------------
export async function getSlot(req, res) {
  try {
    const cols = await getSlotCols();
    const m = buildSlotColumnMap(cols);

    if (!m.page || !m.position || !m.priority) {
      return res.status(500).json({ success: false, error: "admin_ad_slots에 page/position/priority 컬럼이 필요합니다." });
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
    return res.status(500).json({ success: false, error: err?.message || "getSlot 실패" });
  }
}

// ------------------------------
// ✅ GET /admin/subcategory/candidates  (priority 1~6)
// ------------------------------
export async function listCandidates(req, res) {
  try {
    const cols = await getSlotCols();
    const m = buildSlotColumnMap(cols);

    const page = clean(req.query.page);
    const position = clean(req.query.position);
    if (!page || !position) return res.status(400).json({ success: false, error: "page/position 필요" });

    if (!m.page || !m.position || !m.priority) {
      return res.status(500).json({ success: false, error: "admin_ad_slots에 page/position/priority 컬럼이 필요합니다." });
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
    return res.status(500).json({ success: false, error: err?.message || "listCandidates 실패" });
  }
}

// ------------------------------
// ✅ DELETE /admin/subcategory/delete
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

    const sql = `
      DELETE FROM ${SLOTS_TABLE}
      WHERE "${m.page}"=$1 AND "${m.position}"=$2 AND "${m.priority}"=$3
      RETURNING *
    `;
    const { rows } = await pool.query(sql, [page, position, priority]);
    return res.json({ success: true, deleted: rows[0] || null });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || "deleteSlot 실패" });
  }
}

// ------------------------------
// ✅ POST /admin/subcategory/update
// (multipart: image file optional)
// ------------------------------
export async function upsertSlot(req, res) {
  try {
    const cols = await getSlotCols();
    const m = buildSlotColumnMap(cols);

    // 최소 요구
    if (!m.page || !m.position || !m.priority) {
      return res.status(500).json({ success: false, error: "admin_ad_slots에 page/position/priority 컬럼이 필요합니다." });
    }

    const page = clean(req.body.page);
    const position = clean(req.body.position);
    const priority = Math.max(safeInt(req.body.priority, 1), 1);

    if (!page || !position) {
      return res.status(400).json({ success: false, error: "page/position 필요" });
    }

    const adMode = clean(req.body.adMode) || "image";
    const { slot_type, slot_mode } = mapAdModeToSlot(adMode);

    const linkUrl = clean(req.body.linkUrl);
    const textTitle = clean(req.body.textTitle);

    const noEnd = toBool(req.body.noEnd);
    const startAt = parseDateTimeLocalToTs(req.body.startAt);
    const endAt = parseDateTimeLocalToTs(req.body.endAt);

    // 파일 업로드(선택)
    let imageUrl = "";
    if (req.file?.filename) {
      imageUrl = `${UPLOAD_PUBLIC_PREFIX}/${req.file.filename}`;
    }

    // 가게 연결(선택)
    const storeId = safeIntOrNull(req.body.storeId);
    const storeBusinessNumber = clean(req.body.storeBusinessNumber);
    const storeName = clean(req.body.storeName);
    const storeType = clean(req.body.storeType);
    const storeImageUrl = clean(req.body.storeImageUrl);

    // insert/update 컬럼 구성(존재하는 컬럼에만 넣기)
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

    // imageUrl: 파일이 있을 때만 덮어쓰기
    if (imageUrl && m.imageUrl) add(m.imageUrl, imageUrl);

    add(m.textTitle, textTitle);

    if (m.storeId && storeId !== null) add(m.storeId, storeId);
    add(m.storeBiz, storeBusinessNumber);
    add(m.storeName, storeName);
    add(m.storeType, storeType);
    add(m.storeImage, storeImageUrl);

    if (m.noEnd) add(m.noEnd, noEnd);
    if (m.startAt) add(m.startAt, startAt);
    if (m.endAt) add(m.endAt, endAt);

    if (m.updatedAt) add(m.updatedAt, new Date().toISOString());

    // ✅ 1차: ON CONFLICT 시도
    // (unique constraint 없으면 42P10이 나올 수 있어 fallback)
    const conflictTarget = `"${m.page}","${m.position}","${m.priority}"`;

    const updateSets = insertCols
      .filter((c) => ![`"${m.page}"`, `"${m.position}"`, `"${m.priority}"`].includes(c))
      .map((c) => `${c}=EXCLUDED.${c}`);

    const sqlUpsert = `
      INSERT INTO ${SLOTS_TABLE} (${insertCols.join(",")})
      VALUES (${insertVals.join(",")})
      ON CONFLICT (${conflictTarget})
      DO UPDATE SET ${updateSets.length ? updateSets.join(",") : `"${m.page}"=EXCLUDED."${m.page}"`}
      RETURNING *
    `;

    try {
      const { rows } = await pool.query(sqlUpsert, params);
      return res.json({ success: true, slot: rows[0] });
    } catch (e) {
      // ✅ unique 제약 없으면 삭제 후 insert로 fallback
      const code = e?.code;
      if (code !== "42P10") throw e;

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
    return res.status(500).json({ success: false, error: err?.message || "upsertSlot 실패" });
  }
}
