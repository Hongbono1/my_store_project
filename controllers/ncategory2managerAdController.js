// controllers/ncategory2managerAdController.js
import fs from "fs";
import path from "path";
import pool from "../db.js";

/**
 * ✅ ncategory2 매니저 전용 업로드 폴더
 *   /data/uploads/ncategory2_ad
 * ✅ 외부 접근
 *   /uploads/ncategory2_ad/파일명
 */
const UPLOAD_SUBDIR = "ncategory2_ad";
const UPLOAD_ROOT = process.env.UPLOAD_DIR || "/data/uploads"; // server.js와 동일 철학
const UPLOAD_ABS_DIR = path.join(UPLOAD_ROOT, UPLOAD_SUBDIR);
const UPLOAD_PUBLIC_PREFIX = `/uploads/${UPLOAD_SUBDIR}`;

const TABLE_SCHEMA = "public";
const TABLE_NAME = "admin_ad_slot_items";
const FULL_TABLE = `${TABLE_SCHEMA}.${TABLE_NAME}`;

// -------------------- 유틸 --------------------
function clean(v) {
  if (v === undefined || v === null) return "";
  return String(v).trim();
}
function digitsOnly(v) {
  return clean(v).replace(/[^\d]/g, "");
}
function toBool(v) {
  const s = String(v ?? "").toLowerCase().trim();
  return ["true", "1", "yes", "y", "on"].includes(s);
}
function safeDate(v) {
  const s = clean(v);
  if (!s) return null;
  return s; // YYYY-MM-DD
}
function ensureDir() {
  fs.mkdirSync(UPLOAD_ABS_DIR, { recursive: true });
}

/** DB 컬럼 목록을 읽어서 "있는 컬럼만" insert/update 하도록 안전하게 */
async function getTableColumnsSet() {
  const r = await pool.query(
    `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = $1 AND table_name = $2
  `,
    [TABLE_SCHEMA, TABLE_NAME]
  );
  return new Set((r.rows || []).map((x) => x.column_name));
}

/** 업로드 파일 -> /uploads/... 경로 */
function toPublicUrlFromFile(file) {
  if (!file?.filename) return null;
  return `${UPLOAD_PUBLIC_PREFIX}/${file.filename}`;
}

/** blob: URL 방지 */
function normalizeImageUrl(v) {
  const s = clean(v);
  if (!s) return null;
  if (s.startsWith("blob:")) return null;
  return s;
}

// -------------------- 컨트롤러 --------------------
export async function getSlot(req, res) {
  try {
    const page = clean(req.query.page);
    const position = clean(req.query.position);
    const priority = Number(clean(req.query.priority) || 1);

    if (!page || !position) {
      return res.status(400).json({ success: false, error: "page/position required" });
    }

    const r = await pool.query(
      `
      SELECT *
      FROM ${FULL_TABLE}
      WHERE page=$1 AND position=$2 AND priority=$3
      LIMIT 1
    `,
      [page, position, priority]
    );

    return res.json({ success: true, slot: r.rows[0] || null });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || "getSlot error" });
  }
}

export async function saveSlot(req, res) {
  try {
    ensureDir();

    const cols = await getTableColumnsSet();

    const page = clean(req.body.page);
    const position = clean(req.body.position);
    const priority = Number(clean(req.body.priority) || 1);

    if (!page || !position) {
      return res.status(400).json({ success: false, error: "page/position required" });
    }

    // 공통 필드(프론트가 어떤 이름으로 보내든 "있으면 저장", 없으면 null)
    const slot_type = clean(req.body.slot_type) || clean(req.body.slotType) || null;
    const slot_mode = clean(req.body.slot_mode) || clean(req.body.slotMode) || null;

    const store_type = clean(req.body.store_type) || clean(req.body.storeType) || null;
    const store_id = clean(req.body.store_id) || clean(req.body.storeId) || null;

    const business_no =
      digitsOnly(req.body.business_no) ||
      digitsOnly(req.body.businessNo) ||
      digitsOnly(req.body.business_number) ||
      digitsOnly(req.body.businessNumber) ||
      null;

    const business_name = clean(req.body.business_name) || clean(req.body.businessName) || null;
    const category = clean(req.body.category) || null;

    const link_url = clean(req.body.link_url) || clean(req.body.linkUrl) || null;
    const text_content = clean(req.body.text_content) || clean(req.body.textContent) || null;

    const no_end = toBool(req.body.no_end ?? req.body.noEnd);
    const start_at = safeDate(req.body.start_at ?? req.body.startAt);
    const end_at = no_end ? null : safeDate(req.body.end_at ?? req.body.endAt);

    // 이미지: 업로드 파일 우선, 그다음 body.image_url
    const uploadedUrl = req.file ? toPublicUrlFromFile(req.file) : null;
    const postedImageUrl = normalizeImageUrl(req.body.image_url ?? req.body.imageUrl);
    const image_url = uploadedUrl || postedImageUrl || null;

    // ✅ "테이블에 존재하는 컬럼만" insert/update 구성
    const data = {
      page,
      position,
      priority,
      slot_type,
      slot_mode,
      store_type,
      store_id,
      business_no,
      business_name,
      category,
      link_url,
      text_content,
      image_url,
      start_at,
      end_at,
      no_end,
      updated_at: new Date(),
    };

    const insertCols = [];
    const insertVals = [];
    const params = [];

    for (const [k, v] of Object.entries(data)) {
      if (!cols.has(k)) continue;
      insertCols.push(k);
      params.push(v);
      insertVals.push(`$${params.length}`);
    }

    // ✅ upsert: (page, position, priority) 유니크가 있으면 그대로 동작
    // 유니크가 없으면 fallback으로 delete+insert 처리
    const conflictCols = ["page", "position", "priority"].filter((c) => cols.has(c));

    const updatePairs = [];
    for (const c of insertCols) {
      if (["page", "position", "priority"].includes(c)) continue;
      if (c === "created_at") continue;
      updatePairs.push(`${c}=EXCLUDED.${c}`);
    }

    const upsertSql = `
      INSERT INTO ${FULL_TABLE} (${insertCols.join(", ")})
      VALUES (${insertVals.join(", ")})
      ${
        conflictCols.length === 3
          ? `ON CONFLICT (page, position, priority) DO UPDATE SET ${updatePairs.join(", ")}`
          : ""
      }
      RETURNING *
    `;

    try {
      const r = await pool.query(upsertSql, params);
      return res.json({ success: true, slot: r.rows[0] });
    } catch (e) {
      // ✅ 유니크 제약 없을 때: delete 후 insert
      const msg = String(e?.message || "");
      if (msg.includes("no unique or exclusion constraint") || conflictCols.length !== 3) {
        await pool.query("BEGIN");
        try {
          await pool.query(
            `DELETE FROM ${FULL_TABLE} WHERE page=$1 AND position=$2 AND priority=$3`,
            [page, position, priority]
          );
          const r2 = await pool.query(
            `INSERT INTO ${FULL_TABLE} (${insertCols.join(", ")}) VALUES (${insertVals.join(
              ", "
            )}) RETURNING *`,
            params
          );
          await pool.query("COMMIT");
          return res.json({ success: true, slot: r2.rows[0] });
        } catch (e2) {
          await pool.query("ROLLBACK");
          throw e2;
        }
      }
      throw e;
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || "saveSlot error" });
  }
}

export async function deleteSlot(req, res) {
  try {
    const page = clean(req.query.page);
    const position = clean(req.query.position);
    const priority = Number(clean(req.query.priority) || 1);

    if (!page || !position) {
      return res.status(400).json({ success: false, error: "page/position required" });
    }

    await pool.query(
      `DELETE FROM ${FULL_TABLE} WHERE page=$1 AND position=$2 AND priority=$3`,
      [page, position, priority]
    );

    // ⚠️ 이미지 파일 삭제는 안 함(공용 이미지/슬롯 참조 위험)
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || "deleteSlot error" });
  }
}

/**
 * 가게 검색 (푸드/통합/스토어)
 * GET /store/search?q=...&bizNo=...
 */
export async function searchStore(req, res) {
  try {
    const q = clean(req.query.q);
    const bizNo = digitsOnly(req.query.bizNo);

    const params = [];
    const whereParts = [];
    if (q) {
      params.push(`%${q}%`);
      whereParts.push(`business_name ILIKE $${params.length}`);
    }
    if (bizNo) {
      params.push(`${bizNo}%`);
      whereParts.push(
        `regexp_replace(COALESCE(business_number::text,''), '[^0-9]', '', 'g') LIKE $${params.length}`
      );
    }
    const where = whereParts.length ? `AND ${whereParts.join(" AND ")}` : "";

    const sql = `
      SELECT
        'food' AS store_type,
        id::text AS id,
        regexp_replace(COALESCE(business_number::text,''), '[^0-9]', '', 'g') AS business_no,
        business_name,
        business_category AS category
      FROM public.food_stores
      WHERE 1=1 ${where}

      UNION ALL

      SELECT
        'combined' AS store_type,
        id::text AS id,
        regexp_replace(COALESCE(business_number::text,''), '[^0-9]', '', 'g') AS business_no,
        business_name,
        business_category AS category
      FROM public.combined_store_info
      WHERE 1=1 ${where}

      UNION ALL

      SELECT
        'store_info' AS store_type,
        id::text AS id,
        regexp_replace(COALESCE(business_number::text,''), '[^0-9]', '', 'g') AS business_no,
        business_name,
        business_category AS category
      FROM public.store_info
      WHERE 1=1 ${where}

      ORDER BY store_type, id::int
      LIMIT 50
    `;

    const r = await pool.query(sql, params);
    return res.json({ success: true, stores: r.rows || [] });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || "searchStore error" });
  }
}
