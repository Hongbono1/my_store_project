// controllers/subcategoryFoodAdController.js
import pool from "../db.js";

// ✅ 푸드 전용은 무조건 store_info 고정
const FOOD_TABLE = "public.store_info";

// ✅ 너 DB에서 실제로 쓰는 이미지 테이블
const FOOD_IMAGE_TABLE = "public.store_images";

function clean(v) {
  return (v ?? "").toString().trim();
}

function digitsOnly(v) {
  return clean(v).replace(/[^\d]/g, "");
}

function safeInt(v, fallback) {
  const n = Number(clean(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
}

const _colsCache = new Map(); // table -> Set(columns)

async function getColumnsSet(fullTable) {
  if (_colsCache.has(fullTable)) return _colsCache.get(fullTable);

  const [schema, table] = fullTable.split(".");
  const { rows } = await pool.query(
    `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = $1 AND table_name = $2
    `,
    [schema, table]
  );

  const set = new Set((rows || []).map((r) => r.column_name));
  _colsCache.set(fullTable, set);
  return set;
}

function pickCol(cols, ...names) {
  for (const n of names) if (cols.has(n)) return n;
  return null;
}

function sqlIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

// ✅ DB에 "/uploads/..."처럼 이미 /로 시작하니까 그대로 써도 되지만,
// 혹시 "uploads/..." 형태도 대비해서 보정
function normalizeUrlSql(exprText) {
  return `
    CASE
      WHEN TRIM(COALESCE(${exprText}::text,'')) = '' THEN ''
      WHEN TRIM(COALESCE(${exprText}::text,'')) ~* '^https?://' THEN TRIM(COALESCE(${exprText}::text,''))
      WHEN LEFT(TRIM(COALESCE(${exprText}::text,'')), 1) = '/' THEN TRIM(COALESCE(${exprText}::text,''))
      ELSE '/' || TRIM(COALESCE(${exprText}::text,''))
    END
  `;
}

/**
 * ✅ 푸드 전용 grid
 * GET /subcategorymanager_food/ad/grid?page=subcategory&section=all_items&pageNo=1&pageSize=12&category=...&subcategory=...
 */
export async function grid(req, res) {
  try {
    const pageNo = Math.max(1, safeInt(req.query.pageNo, 1));
    const pageSize = Math.min(60, Math.max(1, safeInt(req.query.pageSize, 12)));
    const offset = (pageNo - 1) * pageSize;

    const section = clean(req.query.section || "all_items");
    const category = clean(req.query.category);

    // ✅ 푸드 서브는 detail_category 기준
    const subcategory = clean(
      req.query.subcategory || req.query.sub || req.query.detail_category || ""
    );

    // ✅ category 필수
    if (!category) {
      return res.status(400).json({ success: false, error: "category is required" });
    }

    // --- store_info 컬럼 매핑 ---
    const table = FOOD_TABLE;
    const cols = await getColumnsSet(table);

    const colId = pickCol(cols, "id");
    const colBizNo = pickCol(cols, "business_number", "business_no");
    const colName = pickCol(cols, "business_name", "store_name", "name");
    const colType = pickCol(cols, "business_type", "type");
    const colCategory = pickCol(cols, "business_category", "category");
    const colDetail = pickCol(cols, "detail_category");

    // 정렬 후보
    const colCreatedAt = pickCol(cols, "created_at");
    const colViewCount = pickCol(cols, "view_count", "views");

    if (!colId || !colName || !colCategory) {
      return res.status(500).json({
        success: false,
        error: `FOOD table(${table}) required columns missing (need id/name/business_category).`,
      });
    }

    if (!colDetail) {
      return res.status(500).json({
        success: false,
        error: `FOOD table(${table}) has no detail_category column.`,
      });
    }

    // --- store_images 컬럼 매핑 ---
    const imgCols = await getColumnsSet(FOOD_IMAGE_TABLE);
    const imgStoreId = pickCol(imgCols, "store_id");
    const imgUrl = pickCol(imgCols, "url");
    const imgSort = pickCol(imgCols, "sort_order");
    const imgId = pickCol(imgCols, "id");

    if (!imgStoreId || !imgUrl) {
      return res.status(500).json({
        success: false,
        error: `IMAGE table(${FOOD_IMAGE_TABLE}) missing store_id/url`,
      });
    }

    // --- WHERE ---
    const where = [];
    const params = [];

    params.push(category);
    where.push(`TRIM(COALESCE(t.${sqlIdent(colCategory)}::text,'')) = $${params.length}`);

    if (subcategory && subcategory !== "__all__") {
      params.push(subcategory);
      where.push(`TRIM(COALESCE(t.${sqlIdent(colDetail)}::text,'')) = $${params.length}`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    // --- COUNT ---
    const countSql = `SELECT COUNT(*)::int AS cnt FROM ${table} t ${whereSql}`;
    const countRes = await pool.query(countSql, params);
    const total = countRes.rows?.[0]?.cnt ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    // --- ORDER BY (section 반영, 안전 fallback) ---
    let orderSql = `t.${sqlIdent(colId)} DESC`;
    if (section === "new_registration") {
      if (colCreatedAt) orderSql = `t.${sqlIdent(colCreatedAt)} DESC NULLS LAST, t.${sqlIdent(colId)} DESC`;
    } else if (section === "best_seller") {
      if (colViewCount) orderSql = `t.${sqlIdent(colViewCount)} DESC NULLS LAST, t.${sqlIdent(colId)} DESC`;
      else if (colCreatedAt) orderSql = `t.${sqlIdent(colCreatedAt)} DESC NULLS LAST, t.${sqlIdent(colId)} DESC`;
    }

    // ✅ 이미지 1장만 붙이기 (sort_order 0 우선)
    const imgOrderBy = imgSort
      ? `i.${sqlIdent(imgSort)} ASC NULLS LAST, i.${sqlIdent(imgId || imgStoreId)} ASC`
      : `i.${sqlIdent(imgId || imgStoreId)} ASC`;

    const joinSql = `
      LEFT JOIN LATERAL (
        SELECT ${normalizeUrlSql(`i.${sqlIdent(imgUrl)}`)} AS image_url
        FROM ${FOOD_IMAGE_TABLE} i
        WHERE i.${sqlIdent(imgStoreId)} = t.${sqlIdent(colId)}
        ORDER BY ${imgOrderBy}
        LIMIT 1
      ) img ON true
    `;

    // --- SELECT ---
    const selectParts = [
      `t.${sqlIdent(colId)} AS id`,
      colBizNo ? `t.${sqlIdent(colBizNo)}::text AS business_number` : `''::text AS business_number`,
      `t.${sqlIdent(colName)}::text AS business_name`,
      colType ? `t.${sqlIdent(colType)}::text AS business_type` : `''::text AS business_type`,
      `t.${sqlIdent(colCategory)}::text AS business_category`,
      `COALESCE(NULLIF(TRIM(t.${sqlIdent(colDetail)}::text), ''), '') AS detail_category`,
      `COALESCE(img.image_url, ''::text) AS image_url`,
    ];

    const itemsSql = `
      SELECT ${selectParts.join(", ")}
      FROM ${table} t
      ${joinSql}
      ${whereSql}
      ORDER BY ${orderSql}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const itemsParams = [...params, pageSize, offset];
    const itemsRes = await pool.query(itemsSql, itemsParams);

    const got = itemsRes.rows?.length || 0;
    const hasMore = offset + got < total;

    return res.json({
      success: true,
      mode: "food",
      section,
      pageNo,
      pageSize,
      total,
      totalPages,
      hasMore,
      category,
      subcategory: subcategory || null,
      imageSource: FOOD_IMAGE_TABLE,
      items: itemsRes.rows || [],
    });
  } catch (err) {
    console.error("❌ [subcategoryFood grid]", err?.message || err);
    return res.status(500).json({
      success: false,
      error: err?.message || String(err),
    });
  }
}

/**
 * ✅ 푸드 전용 검색
 * GET /subcategorymanager_food/ad/search-store?q=...
 */
export async function searchStore(req, res) {
  try {
    const qRaw = clean(req.query.q);
    const qDigits = digitsOnly(qRaw);

    const table = FOOD_TABLE;
    const cols = await getColumnsSet(table);

    const colId = pickCol(cols, "id");
    const colBizNo = pickCol(cols, "business_number", "business_no");
    const colName = pickCol(cols, "business_name", "store_name", "name");
    const colType = pickCol(cols, "business_type", "type");
    const colCategory = pickCol(cols, "business_category", "category");
    const colDetail = pickCol(cols, "detail_category");

    if (!colId || !colName) {
      return res.status(500).json({
        success: false,
        error: `FOOD table(${table}) missing id/name`,
      });
    }

    // store_images
    const imgCols = await getColumnsSet(FOOD_IMAGE_TABLE);
    const imgStoreId = pickCol(imgCols, "store_id");
    const imgUrl = pickCol(imgCols, "url");
    const imgSort = pickCol(imgCols, "sort_order");
    const imgId = pickCol(imgCols, "id");

    if (!imgStoreId || !imgUrl) {
      return res.status(500).json({
        success: false,
        error: `IMAGE table(${FOOD_IMAGE_TABLE}) missing store_id/url`,
      });
    }

    const params = [];
    const where = [];

    if (qRaw === "__all__" || qRaw === "") {
      // 전체
    } else if (qDigits && colBizNo) {
      params.push(`%${qDigits}%`);
      where.push(
        `REPLACE(COALESCE(t.${sqlIdent(colBizNo)}::text,''),'-','') ILIKE $${params.length}`
      );
    } else {
      params.push(`%${qRaw}%`);
      where.push(`t.${sqlIdent(colName)}::text ILIKE $${params.length}`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const imgOrderBy = imgSort
      ? `i.${sqlIdent(imgSort)} ASC NULLS LAST, i.${sqlIdent(imgId || imgStoreId)} ASC`
      : `i.${sqlIdent(imgId || imgStoreId)} ASC`;

    const joinSql = `
      LEFT JOIN LATERAL (
        SELECT ${normalizeUrlSql(`i.${sqlIdent(imgUrl)}`)} AS image_url
        FROM ${FOOD_IMAGE_TABLE} i
        WHERE i.${sqlIdent(imgStoreId)} = t.${sqlIdent(colId)}
        ORDER BY ${imgOrderBy}
        LIMIT 1
      ) img ON true
    `;

    const sql = `
      SELECT
        t.${sqlIdent(colId)} AS id,
        ${colBizNo ? `t.${sqlIdent(colBizNo)}::text` : `''::text`} AS business_number,
        t.${sqlIdent(colName)}::text AS business_name,
        ${colType ? `t.${sqlIdent(colType)}::text` : `''::text`} AS business_type,
        ${colCategory ? `t.${sqlIdent(colCategory)}::text` : `''::text`} AS business_category,
        ${colDetail ? `COALESCE(NULLIF(TRIM(t.${sqlIdent(colDetail)}::text), ''), '')` : `''::text`} AS detail_category,
        COALESCE(img.image_url, ''::text) AS image_url
      FROM ${table} t
      ${joinSql}
      ${whereSql}
      ORDER BY t.${sqlIdent(colId)} DESC
      LIMIT 30
    `;

    const r = await pool.query(sql, params);

    return res.json({
      success: true,
      mode: "food",
      q: qRaw,
      imageSource: FOOD_IMAGE_TABLE,
      results: r.rows || [],
    });
  } catch (err) {
    console.error("❌ [subcategoryFood searchStore]", err?.message || err);
    return res.status(500).json({
      success: false,
      error: err?.message || String(err),
    });
  }
}
