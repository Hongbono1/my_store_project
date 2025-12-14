// controllers/subcategoryController.js
import pool from "../db.js";

/* 공통: 문자열 정리 */
function normStr(v) {
    return String(v ?? "").trim();
}

/* ======================== 음식점 전용 ======================== */
// ✅ GET /api/subcategory/food?category=한식&sub=밥
export async function getFoodStoresByCategory(req, res) {
    const category = normStr(req.query.category);
    const sub = normStr(req.query.sub); // ✅ detail_category 필터

    if (!category) {
        return res.status(400).json({ ok: false, error: "no_category" });
    }

    try {
        // 캐시로 304 뜨는 거 헷갈리면 이거 추천(원하면 빼도 됨)
        res.setHeader("Cache-Control", "no-store");

        const params = [category];
        let where = `
      WHERE s.business_category = $1
        AND COALESCE(NULLIF(TRIM(s.business_type), ''), '음식점') = '음식점'
    `;

        // ✅ sub가 있으면 detail_category로 정확히 분리
        if (sub) {
            // "기타한식"은 null/빈값도 기타로 취급하고 싶으면 이렇게
            if (sub === "기타한식") {
                where += `
          AND COALESCE(NULLIF(TRIM(s.detail_category), ''), '기타한식') = '기타한식'
        `;
            } else {
                params.push(sub);
                where += `
          AND TRIM(COALESCE(s.detail_category, '')) = $${params.length}
        `;
            }
        }

        const q = `
      SELECT
        s.id,
        s.business_name,
        s.business_category AS category,
        TRIM(COALESCE(s.detail_category,'')) AS detail_category,
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
    `;

        const result = await pool.query(q, params);

        const stores = result.rows.map((r) => ({
            id: r.id,
            name: r.business_name,
            category: r.category,
            detail_category: r.detail_category || null, // ✅ 프론트 디버그용
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
// GET /api/subcategory/beauty?category=Soap
export async function getCombinedStoresByCategory(req, res) {
    const category = normStr(req.query.category);
    if (!category) {
        return res.status(400).json({ ok: false, error: "category가 필요합니다." });
    }

    try {
        res.setHeader("Cache-Control", "no-store");

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
        res.setHeader("Cache-Control", "no-store");

        const result = await pool.query(
            `
      SELECT s.id,
             s.business_name,
             s.business_category AS category,
             TRIM(COALESCE(s.detail_category,'')) AS detail_category,
             '음식점' AS business_type,
             COALESCE((SELECT url FROM store_images WHERE store_id = s.id ORDER BY sort_order, id LIMIT 1), '') AS image
      FROM store_info s
      WHERE COALESCE(NULLIF(TRIM(s.business_type), ''), '음식점') = '음식점'
      ORDER BY s.created_at DESC NULLS LAST, s.id DESC
      LIMIT 20
      `
        );

        const stores = result.rows.map((r) => ({
            id: r.id,
            name: r.business_name,
            category: r.category,
            detail_category: r.detail_category || null,
            image: r.image || "/uploads/no-image.png",
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
        res.setHeader("Cache-Control", "no-store");

        const result = await pool.query(
            `
      SELECT s.id,
             s.business_name,
             s.business_category AS category,
             TRIM(COALESCE(s.detail_category,'')) AS detail_category,
             '음식점' AS business_type,
             COALESCE((SELECT url FROM store_images WHERE store_id = s.id ORDER BY sort_order, id LIMIT 1), '') AS image
      FROM store_info s
      WHERE COALESCE(NULLIF(TRIM(s.business_type), ''), '음식점') = '음식점'
        AND s.created_at >= NOW() - INTERVAL '7 days'
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
        res.setHeader("Cache-Control", "no-store");

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
        res.setHeader("Cache-Control", "no-store");

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
