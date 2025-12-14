// controllers/subcategoryController.js
import pool from "../db.js";

/** ======================== 음식점 전용 ======================== */
// ✅ GET /api/subcategory/food?category=한식&sub=밥
export async function getFoodStoresByCategory(req, res) {
  const category = String(req.query.category || "").trim();
  const subRaw = String(req.query.sub || "").trim();

  if (!category) {
    return res.status(400).json({ ok: false, error: "no_category" });
  }

  // 디버그용
  console.log("[getFoodStoresByCategory] category:", category, "sub:", subRaw);

  try {
    const params = [category];
    let where = `WHERE s.business_category = $1`;

    // ✅ sub가 있으면 detail_category로 분기
    if (subRaw) {
      if (subRaw === "All" || subRaw === "전체") {
        // 필터 없음
      } else if (subRaw === "기타한식" || subRaw.startsWith("기타")) {
        // 기타: NULL/빈값/기타한식
        where += ` AND (s.detail_category IS NULL OR btrim(s.detail_category) = '' OR btrim(s.detail_category) ILIKE $2)`;
        params.push(`${subRaw}%`);
      } else {
        params.push(subRaw);
        where += ` AND btrim(COALESCE(s.detail_category,'')) = $2`;
      }
    }

    const result = await pool.query(
      `
      SELECT
        s.id,
        s.business_name,
        s.business_type,
        s.business_category AS category,
        s.detail_category,
        COALESCE((
          SELECT url
          FROM store_images
          WHERE store_id = s.id
          ORDER BY sort_order, id
          LIMIT 1
        ), '') AS image
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
      detail_category: r.detail_category || null,
      image: r.image && r.image.trim() !== "" ? r.image : "/uploads/no-image.png",
      business_type: r.business_type && String(r.business_type).trim() !== "" ? r.business_type : "음식점",
    }));

    return res.json({ ok: true, stores });
  } catch (err) {
    console.error("getFoodStoresByCategory error:", err);
    return res.status(500).json({ ok: false, error: "food 서브카테고리 조회 실패" });
  }
}

/** ======================== 통합/뷰티 ======================== */
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
      SELECT s.id,
             s.business_name,
             s.business_category AS category,
             s.detail_category,
             s.business_type,
             COALESCE((SELECT url FROM store_images WHERE store_id = s.id ORDER BY sort_order, id LIMIT 1), '') AS image
      FROM store_info s
      ORDER BY s.view_count DESC NULLS LAST, s.created_at DESC
      LIMIT 20
      `
    );

    const stores = result.rows.map((r) => ({
      id: r.id,
      name: r.business_name,
      category: r.category,
      detail_category: r.detail_category || null,
      image: r.image || "/uploads/no-image.png",
      business_type: r.business_type || "음식점",
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
      SELECT s.id,
             s.business_name,
             s.business_category AS category,
             s.detail_category,
             s.business_type,
             COALESCE((SELECT url FROM store_images WHERE store_id = s.id ORDER BY sort_order, id LIMIT 1), '') AS image
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
      detail_category: r.detail_category || null,
      image: r.image || "/uploads/no-image.png",
      business_type: r.business_type || "음식점",
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

    return res.json({ ok: true, stores });
  } catch (err) {
    console.error("getNewCombinedStores error:", err);
    return res.status(500).json({ ok: false, error: "combined 신규 가게 조회 실패" });
  }
}
