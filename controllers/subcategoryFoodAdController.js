// controllers/subcategoryFoodAdController.js
import pool from "../db.js";

// ✅ 푸드 전용은 무조건 store_info 고정
const FOOD_TABLE = "public.store_info";
const FOOD_IMAGES_TABLE = "public.store_images"; // ✅ store_id, url, sort_order

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

function sqlIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
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

// ✅ 이미지 1장(대표) 붙이기: store_images에서 sort_order ASC(없으면 id ASC) 1장
function buildImageJoin(storeIdIdent) {
  return `
    LEFT JOIN LATERAL (
      SELECT url
      FROM ${FOOD_IMAGES_TABLE}
      WHERE store_id = ${storeIdIdent}
      ORDER BY COALESCE(sort_order, 0) ASC, id ASC
      LIMIT 1
    ) img ON TRUE
  `;
}

// ✅ grid: all_items / best_seller / new_registration
// GET /subcategorymanager_food/ad/grid?page=subcategory&section=all_items&pageNo=1&pageSize=12&category=...&subcategory=...
export async function grid(req, res) {
  try {
    const section = clean(req.query.section || "all_items"); // all_items | best_seller | new_registration
    const pageNo = Math.max(1, safeInt(req.query.pageNo, 1));
    const pageSize = Math.min(60, Math.max(1, safeInt(req.query.pageSize, 12)));
    const offset = (pageNo - 1) * pageSize;

    const category = clean(req.query.category);

    // ✅ 푸드 서브는 detail_category 기준
    const subcategory = clean(
      req.query.subcategory || req.query.sub || req.query.detail_category || ""
    );

    const table = FOOD_TABLE;
    const cols = await getColumnsSet(table);

    // store_info 컬럼 매핑
    const colId = pickCol(cols, "id");
    const colBizNo = pickCol(cols, "business_number", "business_no");
    const colName = pickCol(cols, "business_name", "store_name", "name");
    const colType = pickCol(cols, "business_type", "type");
    const colCategory = pickCol(cols, "business_category", "category");
    const colDetail = pickCol(cols, "detail_category");
    const colCreatedAt = pickCol(cols, "created_at", "opened_at", "open_date", "opening_date");

    // ✅ 조회수/클릭수 후보 컬럼들(있으면 Best Seller에서 사용)
    const colViews = pickCol(
      cols,
      "view_count",
      "views",
      "click_count",
      "clicks",
      "hit",
      "hits",
      "cnt_view",
      "cnt_click"
    );

    if (!colId || !colName) {
      return res.status(500).json({
        success: false,
        error: `FOOD table(${table}) required columns missing (need id/name).`,
      });
    }

    // ✅ where / order 분기
    const where = [];
    const params = [];

    // all_items는 category 필수(전체 스캔 방지)
    if (section === "all_items") {
      if (!category) {
        return res.status(400).json({
          success: false,
          error: "category is required for all_items",
        });
      }

      if (!colCategory) {
        return res.status(500).json({
          success: false,
          error: `FOOD table(${table}) has no business_category column.`,
        });
      }

      params.push(category);
      where.push(
        `TRIM(COALESCE(${sqlIdent(colCategory)}::text,'')) = $${params.length}`
      );

      // 한식 등 서브필터(detail_category)
      if (subcategory && subcategory !== "__all__") {
        if (!colDetail) {
          return res.status(500).json({
            success: false,
            error: `FOOD table(${table}) has no detail_category column.`,
          });
        }
        params.push(subcategory);
        where.push(
          `TRIM(COALESCE(${sqlIdent(colDetail)}::text,'')) = $${params.length}`
        );
      }
    }

    // new_registration: 최근 60일 기준 (category 무시)
    if (section === "new_registration") {
      const dateCol = colCreatedAt || "created_at";
      // created_at 없으면 id desc라도 동작
      if (cols.has(dateCol)) {
        where.push(`${sqlIdent(dateCol)} >= (NOW() - INTERVAL '60 days')`);
      }
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    // ✅ ORDER BY
    let orderBySql = `${sqlIdent(colId)} DESC`;

    if (section === "best_seller") {
      // 조회수 컬럼 있으면 그걸로 정렬 + tie-breaker id desc
      if (colViews) {
        orderBySql = `COALESCE(${sqlIdent(colViews)}::bigint, 0) DESC, ${sqlIdent(colId)} DESC`;
      } else {
        // 컬럼 없으면 일단 최신순(서버는 정상동작)
        orderBySql = `${sqlIdent(colId)} DESC`;
      }
    }

    if (section === "new_registration") {
      const dateCol = colCreatedAt && cols.has(colCreatedAt) ? colCreatedAt : null;
      if (dateCol) {
        orderBySql = `${sqlIdent(dateCol)} DESC, ${sqlIdent(colId)} DESC`;
      } else {
        orderBySql = `${sqlIdent(colId)} DESC`;
      }
    }

    // ✅ COUNT
    const countSql = `SELECT COUNT(*)::int AS cnt FROM ${table} ${whereSql}`;
    const countRes = await pool.query(countSql, params);
    const total = countRes.rows?.[0]?.cnt ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    // ✅ ITEMS (이미지 LATERAL JOIN)
    const storeIdIdent = `s.${sqlIdent(colId)}`;
    const imageJoinSql = buildImageJoin(storeIdIdent);

    const selectParts = [
      `s.${sqlIdent(colId)} AS id`,
      colBizNo
        ? `s.${sqlIdent(colBizNo)}::text AS business_number`
        : `''::text AS business_number`,
      `s.${sqlIdent(colName)}::text AS business_name`,
      colType ? `s.${sqlIdent(colType)}::text AS business_type` : `''::text AS business_type`,
      colCategory
        ? `s.${sqlIdent(colCategory)}::text AS business_category`
        : `''::text AS business_category`,
      colDetail
        ? `COALESCE(NULLIF(TRIM(s.${sqlIdent(colDetail)}::text), ''), '') AS detail_category`
        : `''::text AS detail_category`,
      // ✅ 대표 이미지
      `COALESCE(NULLIF(TRIM(img.url::text), ''), '') AS image_url`,
      // ✅ 조회수(있으면 내려줌)
      colViews
        ? `COALESCE(${sqlIdent(colViews)}::bigint, 0) AS view_count`
        : `0::bigint AS view_count`,
    ];

    const itemsSql = `
      SELECT ${selectParts.join(", ")}
      FROM ${table} s
      ${imageJoinSql}
      ${whereSql}
      ORDER BY ${orderBySql}
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

      // all_items만 의미 있는 값
      category: section === "all_items" ? category : null,
      subcategory: section === "all_items" ? (subcategory || null) : null,

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

    const params = [];
    const where = [];

    if (qRaw === "__all__" || qRaw === "") {
      // 전체
    } else if (qDigits && colBizNo) {
      params.push(`%${qDigits}%`);
      where.push(
        `REPLACE(COALESCE(${sqlIdent(colBizNo)}::text,''),'-','') ILIKE $${params.length}`
      );
    } else {
      params.push(`%${qRaw}%`);
      where.push(`${sqlIdent(colName)}::text ILIKE $${params.length}`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const storeIdIdent = `s.${sqlIdent(colId)}`;
    const imageJoinSql = buildImageJoin(storeIdIdent);

    const sql = `
      SELECT
        s.${sqlIdent(colId)} AS id,
        ${colBizNo ? `s.${sqlIdent(colBizNo)}::text` : `''::text`} AS business_number,
        s.${sqlIdent(colName)}::text AS business_name,
        ${colType ? `s.${sqlIdent(colType)}::text` : `''::text`} AS business_type,
        ${colCategory ? `s.${sqlIdent(colCategory)}::text` : `''::text`} AS business_category,
        ${colDetail ? `COALESCE(NULLIF(TRIM(s.${sqlIdent(colDetail)}::text), ''), '')` : `''::text`} AS detail_category,
        COALESCE(NULLIF(TRIM(img.url::text), ''), '') AS image_url
      FROM ${table} s
      ${imageJoinSql}
      ${whereSql}
      ORDER BY s.${sqlIdent(colId)} DESC
      LIMIT 30
    `;

    const r = await pool.query(sql, params);

    return res.json({
      success: true,
      mode: "food",
      q: qRaw,
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
