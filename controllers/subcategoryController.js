// controllers/subcategoryController.js
import pool from "../db.js";

function norm(v) {
  return (v ?? "").toString().trim();
}

/** ======================== 음식점 전용 ======================== */
// 👉 GET /api/subcategory/food?category=한식&sub=밥
export async function getFoodStoresByCategory(req, res) {
  const category = norm(req.query.category);
  const sub = norm(req.query.sub); // ✅ 추가

  if (!category) {
    return res.status(400).json({ ok: false, error: "no_category" });
  }

  try {
    // ✅ detail_category 포함 + 한식일 때 sub 필터 적용
    let sql = `
      SELECT
        s.id,
        s.business_name,
        s.business_category AS category,
        COALESCE(NULLIF(TRIM(s.detail_category), ''), '') AS detail_category,
        '음식점' AS business_type,
        COALESCE((
          SELECT url
          FROM store_images
          WHERE store_id = s.id
          ORDER BY sort_order, id
          LIMIT 1
        ), '') AS image
      FROM store_info s
      WHERE s.business_category = $1
    `;
    const params = [category];

    // ✅ 한식의 소분류만 sub로 분리 (다른 카테고리는 sub 무시)
    if (category === "한식" && sub) {
      if (sub === "기타한식" || sub === "기타") {
        // detail_category 비어있는 애들은 기타한식으로 묶기
        sql += ` AND (s.detail_category IS NULL OR TRIM(s.detail_category) = '' OR s.detail_category = '기타한식')`;
      } else {
        sql += ` AND TRIM(s.detail_category) = $2`;
        params.push(sub);
      }
    }

    sql += ` ORDER BY s.created_at DESC`;

    const result = await pool.query(sql, params);

    const stores = result.rows.map((r) => ({
      id: r.id,
      name: r.business_name,
      category: r.category,
      detail_category: r.detail_category || "기타한식",
      image: r.image && r.image.trim() !== "" ? r.image : "/uploads/no-image.png",
      business_type: r.business_type,
    }));

    return res.json({ ok: true, stores });
  } catch (err) {
    console.error("getFoodStoresByCategory error:", err);
    return res.status(500).json({ ok: false, error: "food 서브카테고리 조회 실패" });
  }
}

/** ======================== 통합/뷰티 ======================== */
// 👉 GET /api/subcategory/beauty?category=미용실
export async function getCombinedStoresByCategory(req, res) {
  const category = norm(req.query.category);
  if (!category) {
    return res.status(400).json({ ok: false, error: "category가 필요합니다." });
  }

  try {
    const result = await pool.query(
      `
      SELECT
        cs.id,
        cs.business_name,
        cs.business_category AS category,
        cs.business_type,
        COALESCE((SELECT url FROM combined_store_images WHERE store_id = cs.id LIMIT 1), '') AS image
      FROM combined_store_info cs
      WHERE cs.business_category ILIKE $1
      ORDER BY cs.created_at DESC
      LIMIT 20
      `,
      [`%${category}%`]
    );

    const stores = result.rows.map((r) => ({
      id: r.id,
      name: r.business_name,
      category: r.category,
      business_type: r.business_type,
      image: r.image && r.image.trim() !== "" ? r.image : "/uploads/no-image.png",
    }));

    return res.json({ ok: true, stores });
  } catch (err) {
    console.error("getCombinedStoresByCategory error:", err);
    return res.status(500).json({ ok: false, error: "combined 서브카테고리 조회 실패" });
  }
}

/** ======================== Best / New ======================== */
export async function getBestFoodStores(req, res) {
  try {
    const result = await pool.query(
      `
      SELECT
        s.id,
        s.business_name,
        s.business_category AS category,
        COALESCE(NULLIF(TRIM(s.detail_category), ''), '') AS detail_category,
        '음식점' AS business_type,
        COALESCE((SELECT url FROM store_images WHERE store_id = s.id LIMIT 1), '') AS image
      FROM store_info s
      ORDER BY s.view_count DESC NULLS LAST, s.created_at DESC
      LIMIT 20
      `
    );

    const stores = result.rows.map((r) => ({
      id: r.id,
      name: r.business_name,
      category: r.category,
      detail_category: r.detail_category || "기타한식",
      image: r.image && r.image.trim() !== "" ? r.image : "/uploads/no-image.png",
      business_type: r.business_type,
    }));

    return res.json({ ok: true, stores });
  } catch (err) {
    console.error("getBestFoodStores error:", err);
    return res.status(500).json({ ok: false, error: "food Best stores 조회 실패" });
  }
}

export async function getNewFoodStores(req, res) {
  try {
    const result = await pool.query(
      `
      SELECT
        s.id,
        s.business_name,
        s.business_category AS category,
        COALESCE(NULLIF(TRIM(s.detail_category), ''), '') AS detail_category,
        '음식점' AS business_type,
        COALESCE((SELECT url FROM store_images WHERE store_id = s.id LIMIT 1), '') AS image
      FROM store_info s
      WHERE s.created_at >= NOW() - INTERVAL '7 days'
      ORDER BY s.created_at DESC
      LIMIT 20
      `
    );

    const stores = result.rows.map((r) => ({
      id: r.id,
      name: r.business_name,
      category: r.category,
      detail_category: r.detail_category || "기타한식",
      image: r.image && r.image.trim() !== "" ? r.image : "/uploads/no-image.png",
      business_type: r.business_type,
    }));

    return res.json({ ok: true, stores });
  } catch (err) {
    console.error("getNewFoodStores error:", err);
    return res.status(500).json({ ok: false, error: "food 신규 가게 조회 실패" });
  }
}

export async function getBestCombinedStores(req, res) {
  try {
    const result = await pool.query(
      `
      SELECT
        cs.id,
        cs.business_name,
        cs.business_category AS category,
        cs.business_type,
        COALESCE((SELECT url FROM combined_store_images WHERE store_id = cs.id LIMIT 1), '') AS image
      FROM combined_store_info cs
      ORDER BY cs.view_count DESC NULLS LAST, cs.created_at DESC
      LIMIT 20
      `
    );

    const stores = result.rows.map((r) => ({
      id: r.id,
      name: r.business_name,
      category: r.category,
      image: r.image && r.image.trim() !== "" ? r.image : "/uploads/no-image.png",
      business_type: r.business_type,
    }));

    return res.json({ ok: true, stores });
  } catch (err) {
    console.error("getBestCombinedStores error:", err);
    return res.status(500).json({ ok: false, error: "combined Best stores 조회 실패" });
  }
}

export async function getNewCombinedStores(req, res) {
  try {
    const result = await pool.query(
      `
      SELECT
        cs.id,
        cs.business_name,
        cs.business_category AS category,
        cs.business_type,
        COALESCE((SELECT url FROM combined_store_images WHERE store_id = cs.id LIMIT 1), '') AS image
      FROM combined_store_info cs
      WHERE cs.created_at >= NOW() - INTERVAL '7 days'
      ORDER BY cs.created_at DESC
      LIMIT 20
      `
    );

    const stores = result.rows.map((r) => ({
      id: r.id,
      name: r.business_name,
      category: r.category,
      image: r.image && r.image.trim() !== "" ? r.image : "/uploads/no-image.png",
      business_type: r.business_type,
    }));

    return res.json({ ok: true, stores });
  } catch (err) {
    console.error("getNewCombinedStores error:", err);
    return res.status(500).json({ ok: false, error: "combined 신규 가게 조회 실패" });
  }
}
