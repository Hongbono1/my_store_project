import pool from "../db.js";

/** ======================== 공통 유틸 ======================== */
function normStr(v) {
  return String(v ?? "").trim();
}

/** ======================== 음식점 전용 ======================== */
// 음식점 업종별 가게 조회
// ✅ 한식일 때만 sub(=detail_category)로 분리
export async function getFoodStoresByCategory(req, res) {
  const category = normStr(req.query.category);
  const sub = normStr(req.query.sub);

  if (!category) {
    return res.status(400).json({ ok: false, error: "no_category" });
  }

  // ✅ 한식만 하위 분류 적용
  const useSubFilter = category === "한식" && !!sub;

  try {
    const params = [category];
    let where = `WHERE s.business_category = $1`;

    if (useSubFilter) {
      // ✅ DB값이 없으면 '기타한식'으로 간주해서 필터링
      params.push(sub);
      where += `
        AND COALESCE(NULLIF(BTRIM(s.detail_category), ''), '기타한식') = $2
      `;
    }

    const q = `
      SELECT
        s.id,
        s.business_name,
        s.business_category AS category,
        COALESCE(NULLIF(BTRIM(s.detail_category), ''), '기타한식') AS detail_category,
        '음식점' AS business_type,
        COALESCE((
          SELECT url
          FROM store_images
          WHERE store_id = s.id
          ORDER BY sort_order NULLS LAST, id ASC
          LIMIT 1
        ), '') AS image
      FROM store_info s
      ${where}
      ORDER BY s.created_at DESC
    `;

    const result = await pool.query(q, params);

    const stores = result.rows.map((r) => ({
      id: r.id,
      name: r.business_name,
      category: r.category,
      detail_category: r.detail_category, // ✅ DB 기반(없으면 기타한식)
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
export async function getCombinedStoresByCategory(req, res) {
  const category = normStr(req.query.category);
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
        COALESCE((
          SELECT url
          FROM combined_store_images
          WHERE store_id = cs.id
          ORDER BY sort_order NULLS LAST, id ASC
          LIMIT 1
        ), '') AS image
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
// ✅ view_count 컬럼이 아직 없을 수도 있으니, 있으면 사용 / 없으면 최신순 fallback

export async function getBestFoodStores(req, res) {
  try {
    try {
      const result = await pool.query(`
        SELECT
          s.id,
          s.business_name,
          s.business_category AS category,
          '음식점' AS business_type,
          COALESCE((
            SELECT url FROM store_images WHERE store_id = s.id
            ORDER BY sort_order NULLS LAST, id ASC
            LIMIT 1
          ), '') AS image
        FROM store_info s
        ORDER BY s.view_count DESC NULLS LAST, s.created_at DESC
        LIMIT 20
      `);

      const stores = result.rows.map((r) => ({
        id: r.id,
        name: r.business_name,
        category: r.category,
        image: r.image && r.image.trim() !== "" ? r.image : "/uploads/no-image.png",
        business_type: r.business_type,
      }));

      return res.json({ ok: true, stores });
    } catch (e) {
      // view_count 없으면 fallback
      if (e?.code !== "42703") throw e;

      const result2 = await pool.query(`
        SELECT
          s.id,
          s.business_name,
          s.business_category AS category,
          '음식점' AS business_type,
          COALESCE((
            SELECT url FROM store_images WHERE store_id = s.id
            ORDER BY sort_order NULLS LAST, id ASC
            LIMIT 1
          ), '') AS image
        FROM store_info s
        ORDER BY s.created_at DESC
        LIMIT 20
      `);

      const stores2 = result2.rows.map((r) => ({
        id: r.id,
        name: r.business_name,
        category: r.category,
        image: r.image && r.image.trim() !== "" ? r.image : "/uploads/no-image.png",
        business_type: r.business_type,
      }));

      return res.json({ ok: true, stores: stores2 });
    }
  } catch (err) {
    console.error("getBestFoodStores error:", err);
    return res.status(500).json({ ok: false, error: "food Best stores 조회 실패" });
  }
}

export async function getNewFoodStores(req, res) {
  try {
    const result = await pool.query(`
      SELECT
        s.id,
        s.business_name,
        s.business_category AS category,
        '음식점' AS business_type,
        COALESCE((
          SELECT url FROM store_images WHERE store_id = s.id
          ORDER BY sort_order NULLS LAST, id ASC
          LIMIT 1
        ), '') AS image
      FROM store_info s
      WHERE s.created_at >= NOW() - INTERVAL '7 days'
      ORDER BY s.created_at DESC
      LIMIT 20
    `);

    const stores = result.rows.map((r) => ({
      id: r.id,
      name: r.business_name,
      category: r.category,
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
    try {
      const result = await pool.query(`
        SELECT
          cs.id,
          cs.business_name,
          cs.business_category AS category,
          cs.business_type,
          COALESCE((
            SELECT url FROM combined_store_images WHERE store_id = cs.id
            ORDER BY sort_order NULLS LAST, id ASC
            LIMIT 1
          ), '') AS image
        FROM combined_store_info cs
        ORDER BY cs.view_count DESC NULLS LAST, cs.created_at DESC
        LIMIT 20
      `);

      const stores = result.rows.map((r) => ({
        id: r.id,
        name: r.business_name,
        category: r.category,
        image: r.image && r.image.trim() !== "" ? r.image : "/uploads/no-image.png",
        business_type: r.business_type,
      }));

      return res.json({ ok: true, stores });
    } catch (e) {
      if (e?.code !== "42703") throw e;

      const result2 = await pool.query(`
        SELECT
          cs.id,
          cs.business_name,
          cs.business_category AS category,
          cs.business_type,
          COALESCE((
            SELECT url FROM combined_store_images WHERE store_id = cs.id
            ORDER BY sort_order NULLS LAST, id ASC
            LIMIT 1
          ), '') AS image
        FROM combined_store_info cs
        ORDER BY cs.created_at DESC
        LIMIT 20
      `);

      const stores2 = result2.rows.map((r) => ({
        id: r.id,
        name: r.business_name,
        category: r.category,
        image: r.image && r.image.trim() !== "" ? r.image : "/uploads/no-image.png",
        business_type: r.business_type,
      }));

      return res.json({ ok: true, stores: stores2 });
    }
  } catch (err) {
    console.error("getBestCombinedStores error:", err);
    return res.status(500).json({ ok: false, error: "combined Best stores 조회 실패" });
  }
}

export async function getNewCombinedStores(req, res) {
  try {
    const result = await pool.query(`
      SELECT
        cs.id,
        cs.business_name,
        cs.business_category AS category,
        cs.business_type,
        COALESCE((
          SELECT url FROM combined_store_images WHERE store_id = cs.id
          ORDER BY sort_order NULLS LAST, id ASC
          LIMIT 1
        ), '') AS image
      FROM combined_store_info cs
      WHERE cs.created_at >= NOW() - INTERVAL '7 days'
      ORDER BY cs.created_at DESC
      LIMIT 20
    `);

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
