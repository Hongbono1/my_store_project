// controllers/subcategoryFoodAdController.js
import pool from "../db.js";

// ✅ 푸드 전용은 무조건 store_info 고정 (foodregister로 저장되는 테이블)
const FOOD_TABLE = "public.store_info";

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

/**
 * ✅ 푸드 전용 grid
 * GET /subcategorymanager_food/ad/grid?page=subcategory&section=all_items&pageNo=1&pageSize=12&category=...&subcategory=...
 *
 * - category 필수
 * - 한식 서브는 detail_category 기준
 * - section에 따라 정렬:
 *    - best_seller: view_count 있으면 그것 기준, 없으면 id desc
 *    - new_registration: created_at 있으면 그것 기준, 없으면 id desc
 *    - all_items: id desc
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

        // ✅ category 필수 (전체 스캔 방지)
        if (!category) {
            return res.status(400).json({
                success: false,
                error: "category is required",
            });
        }

        const table = FOOD_TABLE;
        const cols = await getColumnsSet(table);

        // store_info 기준 컬럼 매핑
        const colId = pickCol(cols, "id");
        const colBizNo = pickCol(cols, "business_number", "business_no");
        const colName = pickCol(cols, "business_name", "store_name", "name");
        const colType = pickCol(cols, "business_type", "type");
        const colCategory = pickCol(cols, "business_category", "category");
        const colDetail = pickCol(cols, "detail_category"); // ✅ FOOD는 detail_category
        const colImg = pickCol(
            cols,
            "main_image_url",
            "image_url",
            "image1",
            "image_1",
            "thumbnail_url"
        );

        // (선택) 정렬용 후보 컬럼
        const colCreatedAt = pickCol(cols, "created_at", "createdAt");
        const colViewCount = pickCol(cols, "view_count", "viewCount", "views");

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

        const where = [];
        const params = [];

        // category
        params.push(category);
        where.push(
            `TRIM(COALESCE(${sqlIdent(colCategory)}::text,'')) = $${params.length}`
        );

        // subcategory(detail_category)
        if (subcategory && subcategory !== "__all__") {
            params.push(subcategory);
            where.push(
                `TRIM(COALESCE(${sqlIdent(colDetail)}::text,'')) = $${params.length}`
            );
        }

        const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

        // count
        const countSql = `SELECT COUNT(*)::int AS cnt FROM ${table} ${whereSql}`;
        const countRes = await pool.query(countSql, params);
        const total = countRes.rows?.[0]?.cnt ?? 0;
        const totalPages = Math.max(1, Math.ceil(total / pageSize));

        // ✅ ORDER BY (section 반영, 없으면 안전 fallback)
        let orderSql = `${sqlIdent(colId)} DESC`;
        if (section === "new_registration") {
            if (colCreatedAt) orderSql = `${sqlIdent(colCreatedAt)} DESC NULLS LAST, ${sqlIdent(colId)} DESC`;
            else orderSql = `${sqlIdent(colId)} DESC`;
        } else if (section === "best_seller") {
            if (colViewCount) orderSql = `${sqlIdent(colViewCount)} DESC NULLS LAST, ${sqlIdent(colId)} DESC`;
            else if (colCreatedAt) orderSql = `${sqlIdent(colCreatedAt)} DESC NULLS LAST, ${sqlIdent(colId)} DESC`;
            else orderSql = `${sqlIdent(colId)} DESC`;
        }

        // items
        const selectParts = [
            `${sqlIdent(colId)} AS id`,
            colBizNo
                ? `${sqlIdent(colBizNo)}::text AS business_number`
                : `''::text AS business_number`,
            `${sqlIdent(colName)}::text AS business_name`,
            colType
                ? `${sqlIdent(colType)}::text AS business_type`
                : `''::text AS business_type`,
            `${sqlIdent(colCategory)}::text AS business_category`,
            `COALESCE(NULLIF(TRIM(${sqlIdent(colDetail)}::text), ''), '') AS detail_category`,
            colImg
                ? `COALESCE(NULLIF(TRIM(${sqlIdent(colImg)}::text), ''), '') AS image_url`
                : `''::text AS image_url`,
        ];

        const itemsSql = `
      SELECT ${selectParts.join(", ")}
      FROM ${table}
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
        const colImg = pickCol(
            cols,
            "main_image_url",
            "image_url",
            "image1",
            "image_1",
            "thumbnail_url"
        );

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

        const sql = `
      SELECT
        ${sqlIdent(colId)} AS id,
        ${colBizNo ? `${sqlIdent(colBizNo)}::text` : `''::text`} AS business_number,
        ${sqlIdent(colName)}::text AS business_name,
        ${colType ? `${sqlIdent(colType)}::text` : `''::text`} AS business_type,
        ${colCategory ? `${sqlIdent(colCategory)}::text` : `''::text`} AS business_category,
        ${colDetail ? `COALESCE(NULLIF(TRIM(${sqlIdent(colDetail)}::text), ''), '')` : `''::text`} AS detail_category,
        ${colImg ? `COALESCE(NULLIF(TRIM(${sqlIdent(colImg)}::text), ''), '')` : `''::text`} AS image_url
      FROM ${table}
      ${whereSql}
      ORDER BY ${sqlIdent(colId)} DESC
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
        return res
            .status(500)
            .json({ success: false, error: err?.message || String(err) });
    }
}
