// controllers/newindexmanagerAdController.js
import pool from "../db.js";

const SLOTS_TABLE = "public.admin_ad_slots";
const ITEMS_TABLE = "public.admin_ad_slot_items";

// -------------------- 유틸 --------------------
function clean(v) {
  if (v === undefined || v === null) return "";
  return String(v).trim();
}
function digitsOnly(v) {
  return clean(v).replace(/[^\d]/g, "");
}
function toInt(v, def = 0) {
  const n = Number(String(v ?? "").replace(/[^\d-]/g, ""));
  return Number.isFinite(n) ? n : def;
}

// -------------------- 가게 검색 --------------------
// bizNo(사업자번호) 또는 q(상호 키워드)로 통합 검색
export async function searchStore(req, res) {
  try {
    const bizNo = digitsOnly(req.query.bizNo);
    const q = clean(req.query.q);

    if (!bizNo && !q) {
      return res.status(400).json({ success: false, error: "bizNo or q required" });
    }

    const params = [];
    let whereBiz = "";
    let whereQ = "";

    if (bizNo) {
      params.push(`%${bizNo}%`);
      whereBiz = `AND regexp_replace(COALESCE(business_number::text,''), '[^0-9]', '', 'g') ILIKE $${params.length}`;
    }
    if (q) {
      params.push(`%${q}%`);
      whereQ = `AND (COALESCE(business_name::text,'') ILIKE $${params.length} OR COALESCE(business_category::text,'') ILIKE $${params.length})`;
    }

    // ✅ food_stores / combined_store_info / store_info 를 한 번에 검색
    // 컬럼명( business_number / business_name / business_category ) 기준
    // 테이블에 따라 컬럼이 다르면 여기만 맞춰주면 됨.
    const sql = `
      SELECT
        'food' AS store_type,
        id::text AS id,
        COALESCE(business_number::text,'') AS business_number,
        COALESCE(business_name::text,'') AS business_name,
        COALESCE(business_category::text,'') AS business_category
      FROM public.food_stores
      WHERE 1=1
        ${whereBiz}
        ${whereQ}

      UNION ALL

      SELECT
        'combined' AS store_type,
        id::text AS id,
        COALESCE(business_number::text,'') AS business_number,
        COALESCE(business_name::text,'') AS business_name,
        COALESCE(business_category::text,'') AS business_category
      FROM public.combined_store_info
      WHERE 1=1
        ${whereBiz}
        ${whereQ}

      UNION ALL

      SELECT
        'store_info' AS store_type,
        id::text AS id,
        COALESCE(business_number::text,'') AS business_number,
        COALESCE(business_name::text,'') AS business_name,
        COALESCE(business_category::text,'') AS business_category
      FROM public.store_info
      WHERE 1=1
        ${whereBiz}
        ${whereQ}

      ORDER BY store_type, id::int
      LIMIT 50
    `;

    const { rows } = await pool.query(sql, params);
    return res.json({ success: true, items: rows });
  } catch (err) {
    console.error("[newindexmanager][searchStore] error:", err);
    return res.status(500).json({ success: false, error: err?.message || "server error" });
  }
}

// -------------------- 슬롯 조회(단일) --------------------
export async function getSlot(req, res) {
  try {
    const page = clean(req.query.page);
    const position = clean(req.query.position);

    if (!page || !position) {
      return res.status(400).json({ success: false, error: "page and position required" });
    }

    const sql = `
      SELECT *
      FROM ${SLOTS_TABLE}
      WHERE page = $1 AND position = $2
      LIMIT 1
    `;
    const { rows } = await pool.query(sql, [page, position]);

    return res.json({ success: true, slot: rows[0] || null });
  } catch (err) {
    console.error("[newindexmanager][getSlot] error:", err);
    return res.status(500).json({ success: false, error: err?.message || "server error" });
  }
}

// -------------------- 슬롯 목록 --------------------
export async function listSlots(req, res) {
  try {
    const page = clean(req.query.page); // optional
    const params = [];
    let where = "WHERE 1=1";
    if (page) {
      params.push(page);
      where += ` AND page = $${params.length}`;
    }

    const sql = `
      SELECT *
      FROM ${SLOTS_TABLE}
      ${where}
      ORDER BY page, position
    `;
    const { rows } = await pool.query(sql, params);
    return res.json({ success: true, items: rows });
  } catch (err) {
    console.error("[newindexmanager][listSlots] error:", err);
    return res.status(500).json({ success: false, error: err?.message || "server error" });
  }
}

// -------------------- 슬롯 아이템(멀티) 조회 --------------------
export async function listSlotItems(req, res) {
  try {
    const page = clean(req.query.page);
    const position = clean(req.query.position);

    if (!page || !position) {
      return res.status(400).json({ success: false, error: "page and position required" });
    }

    const sql = `
      SELECT *
      FROM ${ITEMS_TABLE}
      WHERE page = $1 AND position = $2
      ORDER BY COALESCE(priority, 999999) ASC, id ASC
    `;
    const { rows } = await pool.query(sql, [page, position]);

    return res.json({ success: true, items: rows });
  } catch (err) {
    // 아이템 테이블이 아직 없거나 컬럼이 다를 수도 있으니 로그는 남기고 빈 배열로도 가능
    console.error("[newindexmanager][listSlotItems] error:", err);
    return res.status(500).json({ success: false, error: err?.message || "server error" });
  }
}

// -------------------- 슬롯 저장(업서트) --------------------
// ✅ ON CONFLICT 의존 없이: 먼저 존재 확인 → update/insert
export async function upsertSlot(req, res) {
  const client = await pool.connect();
  try {
    const page = clean(req.body.page);
    const position = clean(req.body.position);

    if (!page || !position) {
      return res.status(400).json({ success: false, error: "page and position required" });
    }

    const label = clean(req.body.label);
    const type = clean(req.body.type) || null;

    const image_url = clean(req.body.image_url) || null;
    const link_url = clean(req.body.link_url) || null;
    const text_content = clean(req.body.text_content) || null;

    const store_type = clean(req.body.store_type) || null;
    const store_id = clean(req.body.store_id) || null;
    const business_number = digitsOnly(req.body.business_number) || null;

    await client.query("BEGIN");

    // 존재 확인
    const findSql = `
      SELECT id
      FROM ${SLOTS_TABLE}
      WHERE page = $1 AND position = $2
      LIMIT 1
    `;
    const found = await client.query(findSql, [page, position]);
    const existingId = found.rows?.[0]?.id;

    if (existingId) {
      const updSql = `
        UPDATE ${SLOTS_TABLE}
        SET
          label = COALESCE($3, label),
          type = COALESCE($4, type),
          image_url = $5,
          link_url = $6,
          text_content = $7,
          store_type = $8,
          store_id = $9,
          business_number = $10,
          updated_at = NOW()
        WHERE id = $1 AND page = $2
        RETURNING *
      `;
      const upd = await client.query(updSql, [
        existingId,
        page,
        label || null,
        type,
        image_url,
        link_url,
        text_content,
        store_type,
        store_id,
        business_number,
      ]);

      await client.query("COMMIT");
      return res.json({ success: true, slot: upd.rows[0] });
    } else {
      const insSql = `
        INSERT INTO ${SLOTS_TABLE}
          (page, position, label, type, image_url, link_url, text_content, store_type, store_id, business_number, created_at, updated_at)
        VALUES
          ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW())
        RETURNING *
      `;
      const ins = await client.query(insSql, [
        page,
        position,
        label || null,
        type,
        image_url,
        link_url,
        text_content,
        store_type,
        store_id,
        business_number,
      ]);

      await client.query("COMMIT");
      return res.json({ success: true, slot: ins.rows[0] });
    }
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch {}
    console.error("[newindexmanager][upsertSlot] error:", err);
    return res.status(500).json({ success: false, error: err?.message || "server error" });
  } finally {
    client.release();
  }
}

// -------------------- 슬롯 삭제 --------------------
export async function deleteSlot(req, res) {
  try {
    const page = clean(req.query.page || req.body?.page);
    const position = clean(req.query.position || req.body?.position);

    if (!page || !position) {
      return res.status(400).json({ success: false, error: "page and position required" });
    }

    const sql = `
      DELETE FROM ${SLOTS_TABLE}
      WHERE page = $1 AND position = $2
      RETURNING *
    `;
    const { rows } = await pool.query(sql, [page, position]);

    return res.json({ success: true, deleted: rows[0] || null });
  } catch (err) {
    console.error("[newindexmanager][deleteSlot] error:", err);
    return res.status(500).json({ success: false, error: err?.message || "server error" });
  }
}
