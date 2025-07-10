// controllers/categoryController.js
import { pool } from "../db/pool.js";

/* ────────────────────────────────
   ✅ 1) 카테고리 전체 리스트
   ──────────────────────────────── */
export async function getCategories(req, res) {
  try {
    // 나중에 DB SELECT로 교체해도 OK
    res.json(["식사", "분식", "카페"]);
  } catch (err) {
    console.error("🔴 getCategories error:", err);
    res.status(500).json({ error: "서버 오류" });
  }
}

/* ────────────────────────────────
   ✅ 2) 특정 카테고리별 가게 목록
   ──────────────────────────────── */
export async function getStoresByCategory(req, res) {
  const { cat } = req.params;
  const { subcategory } = req.query;

  let sql = `
    SELECT s.id,
           s.business_name AS "businessName",
           s.phone_number  AS "phone",
           COALESCE(s.image1,'') AS "thumb",
           s.business_category AS "category"
    FROM   store_info s
    WHERE  s.business_category = $1`;

  const params = [cat];

  // ⚡️ 반드시 옵션으로 감싸야 함!
  if (subcategory) {
    sql += `
      AND EXISTS (
        SELECT 1 FROM store_menu m
         WHERE m.store_id = s.id
           AND m.category = $2
      )`;
    params.push(subcategory);
  }

  sql += " ORDER BY s.id DESC";

  try {
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "가게 목록 조회 오류" });
  }
}


