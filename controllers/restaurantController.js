// controllers/restaurantController.js
import { pool } from "../db/pool.js";

/* ─────────────────────────────────────────
   1) 파워 광고 4개 (메인 상단)  ─ /restaurant/ads
   ───────────────────────────────────────── */
export async function getPowerAds(req, res) {
  try {
    const { rows } = await pool.query(`
      SELECT  id,
              business_name             AS "title",
              business_category         AS "category",
              phone_number              AS "phone",
              '/uploads/' || image1     AS "img"
      FROM    store_info
      WHERE   is_power_ad = true
      ORDER   BY created_at DESC
      LIMIT   4
    `);

    res.json(rows);
  } catch (err) {
    console.error("[getPowerAds]", err);
    res.status(500).json({ error: "파워 광고 조회 오류" });
  }
}

/* ─────────────────────────────────────────
   2) 카테고리별 가게 목록  ─ /restaurant/:category/stores
   ───────────────────────────────────────── */
export async function getStoresByCategory(req, res) {
  const { category } = req.params;          // ex) 한식, 중식, 양식 …

  try {
    const { rows } = await pool.query(
      `
      SELECT  id,
              business_name             AS "title",
              business_category         AS "category",
              phone_number              AS "phone",
              COALESCE('/uploads/' || image1, '') AS "img",
              search_count,
              view_count,
              click_count
      FROM    store_info
      WHERE   business_category = $1
      ORDER   BY search_count DESC,   -- 많이 검색된 순
               view_count   DESC,     -- → 많이 노출된 순
               click_count  DESC      -- → 많이 클릭된 순
      LIMIT   20
      `,
      [category]
    );

    res.json(rows);
  } catch (err) {
    console.error("[getStoresByCategory]", err);
    res.status(500).json({ error: "카테고리별 가게 조회 오류" });
  }
}
