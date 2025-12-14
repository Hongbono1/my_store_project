// controllers/subcategoryController.js
import pool from "../db.js";

/** ======================== 음식점 전용 ======================== */
// 음식점 업종별 가게 조회
// ✅ GET /api/subcategory/food?category=한식&sub=밥
export async function getFoodStoresByCategory(req, res) {
  const category = (req.query.category || "").trim();
  const subRaw = (req.query.sub || "").trim(); // ✅ 추가

  if (!category) {
    return res.status(400).json({ ok: false, error: "no_category" });
  }

  // ✅ "기타한식"은 detail_category 비어있는 애들로 묶고 싶으면 true
  const isEtcSub =
    subRaw === "기타" ||
    subRaw === "기타한식" ||
    subRaw === "기타 한식" ||
    subRaw === "기타(한식)";

  try {
    const params = [category];
    let where = `
      WHERE s.business_category = $1
        AND s.business_type = '음식점'
    `;

    // ✅ sub가 있으면 detail_category로 분리
    // - 기타한식: detail_category가 NULL/빈값인 가게만
    // - 그 외: detail_category가 sub와 정확히 일치하는 가게만
    if (subRaw) {
      if (isEtcSub) {
        where += ` AND (s.detail_category IS NULL OR TRIM(s.detail_category) = '') `;
      } else {
        params.push(subRaw);
        where += ` AND TRIM(COALESCE(s.detail_category, '')) = $2 `;
      }
    }

    const result = await pool.query(
      `
      SELECT
        s.id,
        s.business_name,
        s.business_category AS category,
        COALESCE(s.detail_category,'') AS detail_category,
        '음식점' AS business_type,
        COALESCE(
          (SELECT url
             FROM store_images
            WHERE store_id = s.id
            ORDER BY sort_order, id
            LIMIT 1),
          ''
        ) AS image
      FROM store_info s
      ${where}
      ORDER BY s.created_at DESC
      `,
      params
    );

    const stores = result.rows.map((r) => ({
      id: r.id,
      name: r.business_name,
      category: r.category,
      detail_category: r.detail_category || "",
      image: r.image && String(r.image).trim() !== "" ? r.image : "/uploads/no-image.png",
      business_type: r.business_type,
    }));

    return res.json({ ok: true, stores });
  } catch (err) {
    console.error("getFoodStoresByCategory error:", err);
    return res.status(500).json({ ok: false, error: "food 서브카테고리 조회 실패" });
  }
}

/** ======================== 통합/뷰티 ======================== */
// 통합/뷰티 서브카테고리 조회
export async function getCombinedStoresByCategory(req, res) {
  const { category } = req.query;
  if (!category) {
    return res.status(400).json({ ok: false, error: "category가 필요합니다." });
  }

  try {
    const result = await pool.query(
      `
      SELECT cs.id,
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

    res.json({ ok: true, stores });
  } catch (err) {
    console.error("getCombinedStoresByCategory error:", err);
    res.status(500).json({ ok: false, error: "combined 서브카테고리 조회 실패" });
  }
}

/** ======================== Best / New ======================== */
// 음식점 Best Seller
export async function getBestFoodStores(req, res) {
  try {
    const result = await pool.query(
      `
      SELECT s.id,
             s.business_name,
             s.business_category AS category,
             '음식점' AS business_type,
             COALESCE((SELECT url FROM store_images WHERE store_id = s.id LIMIT 1), '') AS image
      FROM store_info s
      WHERE s.business_type = '음식점'
      ORDER BY s.view_count DESC NULLS LAST, s.created_at DESC
      LIMIT 20
      `
    );

    const stores = result.rows.map((r) => ({
      id: r.id,
      name: r.business_name,
      category: r.category,
      image: r.image || "/uploads/no-image.png",
      business_type: r.business_type,
    }));

    res.json({ ok: true, stores });
  } catch (err) {
    console.error("getBestFoodStores error:", err);
    res.status(500).json({ ok: false, error: "food Best stores 조회 실패" });
  }
}

// 음식점 신규 등록 (최근 7일)
export async function getNewFoodStores(req, res) {
  try {
    const result = await pool.query(
      `
      SELECT s.id,
             s.business_name,
             s.business_category AS category,
             '음식점' AS business_type,
             COALESCE((SELECT url FROM store_images WHERE store_id = s.id LIMIT 1), '') AS image
      FROM store_info s
      WHERE s.business_type = '음식점'
        AND s.created_at >= NOW() - INTERVAL '7 days'
      ORDER BY s.created_at DESC
      LIMIT 20
      `
    );

    const stores = result.rows.map((r) => ({
      id: r.id,
      name: r.business_name,
      category: r.category,
      image: r.image || "/uploads/no-image.png",
      business_type: r.business_type,
    }));

    res.json({ ok: true, stores });
  } catch (err) {
    console.error("getNewFoodStores error:", err);
    res.status(500).json({ ok: false, error: "food 신규 가게 조회 실패" });
  }
}

// 통합 Best Seller
export async function getBestCombinedStores(req, res) {
  try {
    const result = await pool.query(
      `
      SELECT cs.id,
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
      image: r.image || "/uploads/no-image.png",
      business_type: r.business_type,
    }));

    res.json({ ok: true, stores });
  } catch (err) {
    console.error("getBestCombinedStores error:", err);
    res.status(500).json({ ok: false, error: "combined Best stores 조회 실패" });
  }
}

// 통합 신규 등록 (최근 7일)
export async function getNewCombinedStores(req, res) {
  try {
    const result = await pool.query(
      `
      SELECT cs.id,
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
      image: r.image || "/uploads/no-image.png",
      business_type: r.business_type,
    }));

    res.json({ ok: true, stores });
  } catch (err) {
    console.error("getNewCombinedStores error:", err);
    res.status(500).json({ ok: false, error: "combined 신규 가게 조회 실패" });
  }
}
