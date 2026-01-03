// controllers/ndetailAdController.js
import fs from "fs";
import path from "path";
import pool from "../db.js";

// 업로드 경로(영구 저장 정책)
export const UPLOAD_SUBDIR = "manager_ad";
export const UPLOAD_ABS_DIR = path.join("/data/uploads", UPLOAD_SUBDIR);
export const UPLOAD_PUBLIC_PREFIX = `/uploads/${UPLOAD_SUBDIR}`;

// 슬롯 테이블(기존 재사용)
const SLOTS_TABLE = "public.admin_ad_slots";

// 검색 대상(푸드 + 통합)
const FOOD_TABLE = "public.store_info";
const COMBINED_TABLE = "public.combined_store_info";
const STORE_IMAGES_TABLE = "public.store_images"; // 있으면 food 대표이미지 join

function ensureUploadDir() {
  fs.mkdirSync(UPLOAD_ABS_DIR, { recursive: true });
}
function clean(v) {
  return v === undefined || v === null ? "" : String(v).trim();
}

async function hasTable(fullyQualified) {
  const [schema, table] = fullyQualified.replace(/"/g, "").split(".");
  const q = `
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema=$1 AND table_name=$2
    LIMIT 1
  `;
  const r = await pool.query(q, [schema, table]);
  return r.rowCount > 0;
}

async function hasColumn(fullyQualified, col) {
  const [schema, table] = fullyQualified.replace(/"/g, "").split(".");
  const q = `
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema=$1 AND table_name=$2 AND column_name=$3
    LIMIT 1
  `;
  const r = await pool.query(q, [schema, table, col]);
  return r.rowCount > 0;
}

// DB 시간 -> datetime-local(서울)
function toLocalInput(v) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  const seoul = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const yy = seoul.getFullYear();
  const mm = String(seoul.getMonth() + 1).padStart(2, "0");
  const dd = String(seoul.getDate()).padStart(2, "0");
  const hh = String(seoul.getHours()).padStart(2, "0");
  const mi = String(seoul.getMinutes()).padStart(2, "0");
  return `${yy}-${mm}-${dd}T${hh}:${mi}`;
}

function buildNdetailLink({ storeId, tableSource }) {
  const id = clean(storeId);
  if (!id) return "";
  const src = clean(tableSource).toLowerCase();
  const type = src.includes("combined") ? "combined" : "food";
  return `/ndetail.html?id=${encodeURIComponent(id)}&type=${encodeURIComponent(type)}`;
}

function pickImageFromCombinedRow(row) {
  // combined 쪽은 스키마가 다양할 수 있어서 후보 컬럼들에서 선택
  return (
    clean(row.main_image_url) ||
    clean(row.image_url) ||
    clean(row.thumbnail_url) ||
    clean(row.photo_url) ||
    ""
  );
}

function normalizeSlotRow(row) {
  if (!row) return null;
  return {
    ...row,
    start_at_local: toLocalInput(row.start_date),
    end_at_local: toLocalInput(row.end_date),
  };
}

/** GET /ndetailmanager/ad/slot?page=&position=&priority= */
export async function getSlot(req, res) {
  try {
    const page = clean(req.query.page);
    const position = clean(req.query.position);
    const priorityStr = clean(req.query.priority);

    if (!page || !position) {
      return res.json({ success: false, error: "page/position required" });
    }

    let sql = `SELECT * FROM ${SLOTS_TABLE} WHERE page=$1 AND position=$2`;
    const params = [page, position];

    if (priorityStr) {
      sql += ` AND priority=$3`;
      params.push(Number(priorityStr));
    } else {
      // priority 없으면 대표(가장 작은 priority) 하나 반환
      sql += ` ORDER BY priority ASC NULLS LAST LIMIT 1`;
    }

    const r = await pool.query(sql, params);

    if (r.rowCount === 0) {
      return res.json({ success: true, slot: null });
    }

    const slot = normalizeSlotRow(r.rows[0]);
    return res.json({ success: true, slot });
  } catch (e) {
    console.error("[ndetailmanager] getSlot error:", e);
    return res.status(500).json({ success: false, error: e.message });
  }
}

/** DELETE /ndetailmanager/ad/slot?page=&position=&priority= */
export async function deleteSlot(req, res) {
  try {
    const page = clean(req.query.page);
    const position = clean(req.query.position);
    const priorityStr = clean(req.query.priority);

    if (!page || !position || !priorityStr) {
      return res.json({ success: false, error: "page/position/priority required" });
    }

    const r = await pool.query(
      `DELETE FROM ${SLOTS_TABLE} WHERE page=$1 AND position=$2 AND priority=$3 RETURNING id`,
      [page, position, Number(priorityStr)]
    );

    return res.json({ success: true, deleted: r.rowCount });
  } catch (e) {
    console.error("[ndetailmanager] deleteSlot error:", e);
    return res.status(500).json({ success: false, error: e.message });
  }
}

/**
 * POST /ndetailmanager/ad/slot  (multipart/form-data)
 * fields:
 * page, position, priority
 * slotType, slotMode
 * linkUrl, textContent
 * storeId, businessNo, businessName, imageUrl
 * tableSource
 * startAt, endAt, noEnd
 * file: image
 */
export async function upsertSlot(req, res) {
  try {
    ensureUploadDir();

    const page = clean(req.body.page);
    const position = clean(req.body.position);
    const priority = Number(clean(req.body.priority || "1")) || 1;

    const slotType = clean(req.body.slotType) || "banner";
    const slotMode = clean(req.body.slotMode) || "banner"; // banner/store/text

    const linkUrlRaw = clean(req.body.linkUrl);
    const textContent = clean(req.body.textContent);

    const storeId = clean(req.body.storeId);
    const businessNo = clean(req.body.businessNo);
    const businessName = clean(req.body.businessName);

    const tableSource = clean(req.body.tableSource) || "";
    const noEnd = clean(req.body.noEnd).toLowerCase() === "true";

    const startAt = clean(req.body.startAt);
    const endAt = clean(req.body.endAt);

    if (!page || !position) {
      return res.json({ success: false, error: "page/position required" });
    }

    // 업로드 파일 -> image_url
    let imageUrl = "";
    if (req.file && req.file.filename) {
      imageUrl = `${UPLOAD_PUBLIC_PREFIX}/${req.file.filename}`;
    } else {
      // store 모드면 imageUrl(가게 대표이미지) 허용
      const fallback = clean(req.body.imageUrl);
      if (fallback) imageUrl = fallback;
    }

    // store 모드면 link 자동 생성 (tableSource 기반)
    const linkUrl =
      slotMode === "store"
        ? buildNdetailLink({ storeId, tableSource })
        : linkUrlRaw;

    // 기존 row 확인
    const exist = await pool.query(
      `SELECT * FROM ${SLOTS_TABLE} WHERE page=$1 AND position=$2 AND priority=$3 LIMIT 1`,
      [page, position, priority]
    );

    const startDate = startAt ? new Date(startAt) : null;
    const endDate = !noEnd && endAt ? new Date(endAt) : null;

    // 날짜 파싱 실패 방지
    const safeStart = startDate && !Number.isNaN(startDate.getTime()) ? startDate : null;
    const safeEnd = endDate && !Number.isNaN(endDate.getTime()) ? endDate : null;

    // 업데이트 시: 이미지 업로드가 없으면 기존 image_url 유지 (단, store 모드에서 imageUrl이 왔으면 갱신)
    if (exist.rowCount > 0) {
      const cur = exist.rows[0];
      const finalImageUrl =
        imageUrl ? imageUrl : clean(cur.image_url);

      const upd = await pool.query(
        `
        UPDATE ${SLOTS_TABLE}
        SET
          slot_type=$4,
          slot_mode=$5,
          image_url=$6,
          link_url=$7,
          text_content=$8,
          store_id=$9,
          business_no=$10,
          business_name=$11,
          no_end=$12,
          start_date=$13,
          end_date=$14,
          updated_at=NOW()
        WHERE page=$1 AND position=$2 AND priority=$3
        RETURNING *
        `,
        [
          page,
          position,
          priority,
          slotType,
          slotMode,
          finalImageUrl,
          linkUrl,
          textContent,
          storeId || null,
          businessNo || null,
          businessName || null,
          noEnd,
          safeStart,
          safeEnd,
        ]
      );

      return res.json({ success: true, slot: normalizeSlotRow(upd.rows[0]) });
    }

    // 신규 insert
    const ins = await pool.query(
      `
      INSERT INTO ${SLOTS_TABLE}
      (page, position, priority, slot_type, slot_mode, image_url, link_url, text_content,
       store_id, business_no, business_name, no_end, start_date, end_date, created_at, updated_at)
      VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,
       $9,$10,$11,$12,$13,$14,NOW(),NOW())
      RETURNING *
      `,
      [
        page,
        position,
        priority,
        slotType,
        slotMode,
        imageUrl || "",
        linkUrl || "",
        textContent || "",
        storeId || null,
        businessNo || null,
        businessName || null,
        noEnd,
        safeStart,
        safeEnd,
      ]
    );

    return res.json({ success: true, slot: normalizeSlotRow(ins.rows[0]) });
  } catch (e) {
    console.error("[ndetailmanager] upsertSlot error:", e);
    return res.status(500).json({ success: false, error: e.message });
  }
}

/** GET /ndetailmanager/ad/store/search?bizNo=&q=  (푸드+통합 합쳐서 반환) */
export async function searchStore(req, res) {
  try {
    const bizNo = clean(req.query.bizNo);
    const q = clean(req.query.q);

    const stores = [];

    // --- FOOD (store_info) ---
    if (await hasTable(FOOD_TABLE)) {
      const hasImages = await hasTable(STORE_IMAGES_TABLE);
      const hasBizNoCol = await hasColumn(FOOD_TABLE, "business_number");
      const hasNameCol = await hasColumn(FOOD_TABLE, "business_name");
      const hasCatCol = await hasColumn(FOOD_TABLE, "business_category");

      // 기본 조건
      const where = [];
      const params = [];
      let idx = 1;

      if (bizNo && hasBizNoCol) {
        where.push(`s.business_number ILIKE $${idx++}`);
        params.push(`%${bizNo}%`);
      }
      if (q && hasNameCol) {
        where.push(`s.business_name ILIKE $${idx++}`);
        params.push(`%${q}%`);
      }

      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

      const sql = hasImages
        ? `
          SELECT
            s.id::text AS id,
            ${hasBizNoCol ? "COALESCE(s.business_number,'')::text" : "''::text"} AS business_no,
            ${hasNameCol ? "COALESCE(s.business_name,'')::text" : "''::text"} AS business_name,
            ${hasCatCol ? "COALESCE(s.business_category,'')::text" : "''::text"} AS category,
            COALESCE(img.url,'')::text AS image_url
          FROM ${FOOD_TABLE} s
          LEFT JOIN LATERAL (
            SELECT url
            FROM ${STORE_IMAGES_TABLE} si
            WHERE si.store_id = s.id
            ORDER BY si.id ASC
            LIMIT 1
          ) img ON TRUE
          ${whereSql}
          ORDER BY s.id DESC
          LIMIT 50
        `
        : `
          SELECT
            s.id::text AS id,
            ${hasBizNoCol ? "COALESCE(s.business_number,'')::text" : "''::text"} AS business_no,
            ${hasNameCol ? "COALESCE(s.business_name,'')::text" : "''::text"} AS business_name,
            ${hasCatCol ? "COALESCE(s.business_category,'')::text" : "''::text"} AS category,
            ''::text AS image_url
          FROM ${FOOD_TABLE} s
          ${whereSql}
          ORDER BY s.id DESC
          LIMIT 50
        `;

      const r = await pool.query(sql, params);
      for (const row of r.rows) {
        stores.push({
          id: row.id,
          business_no: row.business_no,
          business_name: row.business_name,
          category: row.category,
          image_url: row.image_url,
          table_source: "store_info",
        });
      }
    }

    // --- COMBINED ---
    if (await hasTable(COMBINED_TABLE)) {
      const hasBizNoCol = await hasColumn(COMBINED_TABLE, "business_number");
      const hasNameCol = await hasColumn(COMBINED_TABLE, "business_name");

      // 이미지 후보 컬럼들 존재 체크
      const cMain = await hasColumn(COMBINED_TABLE, "main_image_url");
      const cImg = await hasColumn(COMBINED_TABLE, "image_url");
      const cThumb = await hasColumn(COMBINED_TABLE, "thumbnail_url");
      const cPhoto = await hasColumn(COMBINED_TABLE, "photo_url");

      const imgExpr =
        cMain ? "c.main_image_url" :
        cImg ? "c.image_url" :
        cThumb ? "c.thumbnail_url" :
        cPhoto ? "c.photo_url" :
        "''";

      const where = [];
      const params = [];
      let idx = 1;

      if (bizNo && hasBizNoCol) {
        where.push(`c.business_number ILIKE $${idx++}`);
        params.push(`%${bizNo}%`);
      }
      if (q && hasNameCol) {
        where.push(`c.business_name ILIKE $${idx++}`);
        params.push(`%${q}%`);
      }
      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

      const sql = `
        SELECT
          c.id::text AS id,
          ${hasBizNoCol ? "COALESCE(c.business_number,'')::text" : "''::text"} AS business_no,
          ${hasNameCol ? "COALESCE(c.business_name,'')::text" : "''::text"} AS business_name,
          ''::text AS category,
          COALESCE(${imgExpr},'')::text AS image_url
        FROM ${COMBINED_TABLE} c
        ${whereSql}
        ORDER BY c.id DESC
        LIMIT 50
      `;

      const r = await pool.query(sql, params);
      for (const row of r.rows) {
        stores.push({
          id: row.id,
          business_no: row.business_no,
          business_name: row.business_name,
          category: row.category,
          image_url: row.image_url,
          table_source: "combined_store_info",
        });
      }
    }

    return res.json({ ok: true, stores });
  } catch (e) {
    console.error("[ndetailmanager] searchStore error:", e);
    return res.status(500).json({ ok: false, error: e.message });
  }
}
