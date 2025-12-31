// controllers/subcategoryCombinedAdController.js
import pool from "../db.js";

const COMBINED_TABLE = "public.combined_store_info";

function clean(v) {
  return (v ?? "").toString().trim();
}

function safeInt(v, fallback) {
  const n = Number(clean(v));
  return Number.isFinite(n) ? n : fallback;
}

/**
 * ✅ 통합 전용 grid
 * GET /subcategorymanager_combined/ad/grid?page=subcategory&section=all_items&pageNo=1&category=...&subcategory=...
 */
export async function grid(req, res) {
  try {
    const pageNo = Math.max(1, safeInt(req.query.pageNo, 1));
    const pageSize = Math.max(1, safeInt(req.query.pageSize, 12));
    const offset = (pageNo - 1) * pageSize;

    const category = clean(req.query.category);
    const subcategory = clean(
      req.query.subcategory ||
        req.query.sub ||
        req.query.detail_category ||
        req.query.business_subcategory
    );

    const params = [];
    const where = [];

    if (category) {
      params.push(category);
      where.push(`TRIM(COALESCE(c.business_category::text,'')) = $${params.length}`);
    }

    // ✅ 통합은 detail_category 컬럼 없음 → business_subcategory / business_type 기준으로 필터
    if (subcategory && subcategory !== "__all__") {
      params.push(subcategory);
      const idx = params.length;
      where.push(
        `(TRIM(COALESCE(c.business_subcategory::text,'')) = $${idx} OR TRIM(COALESCE(c.business_type::text,'')) = $${idx})`
      );
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const countSql = `SELECT COUNT(*)::int AS cnt FROM ${COMBINED_TABLE} c ${whereSql}`;
    const countRes = await pool.query(countSql, params);
    const total = countRes.rows?.[0]?.cnt ?? 0;

    const itemsSql = `
      SELECT
        c.id,
        COALESCE(c.business_number::text,'') AS business_number,
        COALESCE(c.business_name::text,'') AS business_name,
        COALESCE(c.business_type::text,'') AS business_type,
        COALESCE(c.business_category::text,'') AS business_category,

        -- ✅ 프론트 호환: detail_category 라는 이름으로 내려줌
        COALESCE(NULLIF(TRIM(c.business_subcategory::text), ''), NULLIF(TRIM(c.business_type::text), ''), '') AS detail_category,

        COALESCE(NULLIF(TRIM(c.main_image_url::text), ''), '') AS image_url
      FROM ${COMBINED_TABLE} c
      ${whereSql}
      ORDER BY c.id DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    const itemsRes = await pool.query(itemsSql, [...params, pageSize, offset]);

    const hasMore = offset + (itemsRes.rows?.length || 0) < total;

    return res.json({
      success: true,
      mode: "combined",
      pageNo,
      pageSize,
      total,
      hasMore,
      items: itemsRes.rows || [],
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err?.message || String(err),
    });
  }
}

/**
 * ✅ 통합 전용 검색(필요 시)
 * GET /subcategorymanager_combined/ad/search-store?q=...
 */
export async function searchStore(req, res) {
  try {
    const q = clean(req.query.q);
    const params = [];
    const where = [];

    if (q && q !== "__all__") {
      params.push(`%${q}%`);
      where.push(
        `(c.business_name::text ILIKE $${params.length} OR c.business_number::text ILIKE $${params.length})`
      );
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const sql = `
      SELECT
        c.id,
        COALESCE(c.business_number::text,'') AS business_number,
        COALESCE(c.business_name::text,'') AS business_name,
        COALESCE(c.business_type::text,'') AS business_type,
        COALESCE(c.business_category::text,'') AS business_category,
        COALESCE(NULLIF(TRIM(c.business_subcategory::text), ''), NULLIF(TRIM(c.business_type::text), ''), '') AS detail_category,
        COALESCE(NULLIF(TRIM(c.main_image_url::text), ''), '') AS image_url
      FROM ${COMBINED_TABLE} c
      ${whereSql}
      ORDER BY c.id DESC
      LIMIT 30
    `;
    const r = await pool.query(sql, params);

    return res.json({
      success: true,
      mode: "combined",
      q,
      results: r.rows || [],
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || String(err) });
  }
}
