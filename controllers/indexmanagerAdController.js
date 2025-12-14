
// controllers/indexmanagerAdController.js
import fs from "fs";
import path from "path";
import crypto from "crypto";
import pool from "../db.js";

/**
 * ✅ 업로드는 /data/uploads/manager_ad
 * ✅ 외부 접근은 /uploads/manager_ad/파일명 (nginx /uploads alias로 매핑)
 */
export const UPLOAD_SUBDIR = "manager_ad";
export const UPLOAD_ABS_DIR = path.join("/data/uploads", UPLOAD_SUBDIR);
export const UPLOAD_PUBLIC_PREFIX = `/uploads/${UPLOAD_SUBDIR}`;

// ✅ 다른 가게 이미지들도 /data/uploads 아래에 있다고 가정(서버.js와 동일 컨셉)
const DATA_UPLOAD_ROOT = "/data/uploads";

/** ✅ 기존(단일 저장) 테이블 */
const LEGACY_TABLE = "public.admin_ad_slots";
/** ✅ 신규(우선순위 후보) 테이블 */
const ITEMS_TABLE = "public.admin_ad_slot_items";

/* ------------------------- 유틸 ------------------------- */
function ensureUploadDir() {
  fs.mkdirSync(UPLOAD_ABS_DIR, { recursive: true });
}

function cleanStr(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function toBool(v) {
  if (v === true || v === false) return v;
  if (v === undefined || v === null) return false;
  const s = String(v).trim().toLowerCase();
  return ["1", "true", "y", "yes", "on"].includes(s);
}

function toInt(v) {
  const s = cleanStr(v);
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  if (i < 1) return null;
  return i;
}

function digitsOnly(v) {
  const s = cleanStr(v);
  if (!s) return null;
  const d = s.replace(/[^0-9]/g, "");
  return d.length ? d : null;
}

/**
 * ✅ datetime-local(YYYY-MM-DDTHH:mm) → 'YYYY-MM-DD HH:mm:00+09:00'
 */
function toKstTimestamptz(dtLocal) {
  const s = cleanStr(dtLocal);
  if (!s) return null;
  if (/[zZ]|[+\-]\d{2}:\d{2}$/.test(s)) return s;
  const normalized = s.replace("T", " ");
  const [d, tRaw] = normalized.split(" ");
  if (!d || !tRaw) return null;
  const t = tRaw.length === 5 ? `${tRaw}:00` : tRaw;
  return `${d} ${t}+09:00`;
}

function normalizeImageUrl(p) {
  const s = cleanStr(p);
  if (!s) return null;

  // 이미 절대 URL이면 그대로
  if (/^https?:\/\//i.test(s)) return s;

  // /data/uploads/... 로 저장돼있으면 /uploads/... 로 변환
  if (s.startsWith(`${DATA_UPLOAD_ROOT}/`)) {
    return `/uploads/${s.slice(`${DATA_UPLOAD_ROOT}/`.length)}`;
  }

  // uploads/... 형태면 /uploads/... 로
  if (s.startsWith("uploads/")) return `/${s}`;

  // /uploads/... 형태면 그대로
  if (s.startsWith("/uploads/")) return s;

  // 그 외: 이미 / 로 시작하면 그대로, 아니면 /uploads/ 로 붙임(안전용)
  if (s.startsWith("/")) return s;
  return `/uploads/${s}`;
}

function pickBody(req) {
  const b = req?.body || {};
  return {
    page: cleanStr(b.page),
    position: cleanStr(b.position),

    // ✅ 우선순위 (추가)
    priority: toInt(b.priority),

    // 타입/모드
    slotType: cleanStr(b.slotType ?? b.slot_type),
    slotMode: cleanStr(b.slotMode ?? b.slot_mode),

    // 링크/텍스트
    linkUrl: cleanStr(b.linkUrl ?? b.link_url ?? b.link),
    textContent: cleanStr(b.textContent ?? b.text_content ?? b.content),

    // 가게 연결
    storeId: cleanStr(b.storeId ?? b.store_id),
    businessNo: cleanStr(b.businessNo ?? b.business_no ?? b.bizNo ?? b.biz_no),
    businessName: cleanStr(b.businessName ?? b.business_name),

    // 기간
    startAt: cleanStr(b.startAt ?? b.start_at),
    endAt: cleanStr(b.endAt ?? b.end_at),
    noEnd: toBool(b.noEnd ?? b.no_end),

    // 이미지 유지/삭제
    keepImage: toBool(b.keepImage ?? b.keep_image),
    clearImage: toBool(b.clearImage ?? b.clear_image),
  };
}

async function tableExists(client, tableName) {
  const { rows } = await client.query(`SELECT to_regclass($1) AS reg`, [tableName]);
  return !!rows?.[0]?.reg;
}

function mapSlotRow(r) {
  if (!r) return null;
  return {
    page: r.page,
    position: r.position,

    // ✅ 우선순위가 있으면 포함(없으면 null)
    priority: r.priority ?? null,

    image_url: r.image_url,
    link_url: r.link_url,
    text_content: r.text_content,

    business_no: r.business_no,
    business_name: r.business_name,
    store_id: r.store_id,

    slot_type: r.slot_type,
    slot_mode: r.slot_mode,

    no_end: r.no_end,
    start_at: r.start_at,
    end_at: r.end_at,
    start_at_local: r.start_at_local ?? null,
    end_at_local: r.end_at_local ?? null,

    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

/** ✅ 업로드 파일(라우터 fields 대응) */
function pickUploadFile(req) {
  if (req.file) return req.file;
  const f = req.files || {};
  return f.image?.[0] || f.slotImage?.[0] || f.file?.[0] || null;
}

/* -------------------------
 *  공통: 컬럼 존재 확인 유틸 (동적 테이블/컬럼 대응)
 * ------------------------- */
function splitTableRef(full) {
  const [schema, name] = String(full).includes(".")
    ? String(full).split(".")
    : ["public", String(full)];
  return { schema, name };
}

async function pickExistingColumn(client, fullTable, candidates) {
  const { schema, name } = splitTableRef(fullTable);
  const list = (candidates || []).filter(Boolean);
  if (!list.length) return null;

  const { rows } = await client.query(
    `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = $1
      AND table_name   = $2
      AND column_name = ANY($3::text[])
    ORDER BY array_position($3::text[], column_name)
    LIMIT 1
    `,
    [schema, name, list]
  );

  return rows?.[0]?.column_name || null;
}

async function pickExistingColumns(client, fullTable, candidates) {
  const { schema, name } = splitTableRef(fullTable);
  const list = (candidates || []).filter(Boolean);
  if (!list.length) return [];

  const { rows } = await client.query(
    `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = $1
      AND table_name   = $2
      AND column_name = ANY($3::text[])
    ORDER BY array_position($3::text[], column_name)
    `,
    [schema, name, list]
  );

  return (rows || []).map((r) => r.column_name).filter(Boolean);
}

/* -------------------------
 * ✅ 핵심: "가게 대표이미지 자동 대입"
 * - 슬롯 이미지가 없으면 store_id/business_no 기준으로 대표 이미지 찾아줌
 * - 가능한 테이블들에서 순차 탐색
 * ------------------------- */
async function resolveStoreMainImage(client, { storeId, businessNo, businessName }) {
  const sid = cleanStr(storeId);
  const bizDigits = digitsOnly(businessNo);
  const bname = cleanStr(businessName);

  // 탐색 대상(필요하면 여기만 늘리면 됨)
  const sources = [
    {
      table: "public.combined_store_info",
      idCandidates: ["id", "store_id"],
      bizCandidates: ["business_number", "business_no", "biz_no", "bizno", "businessnum", "b_no", "bno"],
      nameCandidates: ["business_name", "store_name", "name", "title"],
      // 대표이미지 후보 우선순위
      imgCandidates: ["main_image_url", "main_img", "image_url", "cover_image", "image_path", "image1", "image2", "image3"],
      updatedCandidates: ["updated_at", "modified_at"],
    },
    {
      table: "public.store_info",
      idCandidates: ["id", "store_id"],
      bizCandidates: ["business_number", "business_no", "biz_no", "bizno", "businessnum", "b_no", "bno"],
      nameCandidates: ["business_name", "store_name", "name", "title"],
      imgCandidates: ["main_image_url", "main_img", "image_url", "image_path", "image1", "image2", "image3"],
      updatedCandidates: ["updated_at", "modified_at"],
    },
    {
      table: "public.food_store_images",
      // 이미지 테이블은 store_id + image_url 형태가 일반적
      storeIdColCandidates: ["store_id", "id"],
      imgCandidates: ["image_url", "image_path", "file_path", "url"],
      updatedCandidates: ["updated_at", "created_at", "id"],
      kind: "images",
    },
    // 혹시 다른 이미지 테이블이 있으면 여기 추가 가능
    { table: "public.store_images", storeIdColCandidates: ["store_id", "id"], imgCandidates: ["image_url", "image_path", "file_path", "url"], updatedCandidates: ["updated_at", "created_at", "id"], kind: "images" },
    { table: "public.combined_store_images", storeIdColCandidates: ["store_id", "id"], imgCandidates: ["image_url", "image_path", "file_path", "url"], updatedCandidates: ["updated_at", "created_at", "id"], kind: "images" },
  ];

  for (const s of sources) {
    const ok = await tableExists(client, s.table);
    if (!ok) continue;

    // 이미지 컬럼 확보
    const imgCols = await pickExistingColumns(client, s.table, s.imgCandidates);
    if (!imgCols.length) continue;

    // images 테이블(다건) 처리
    if (s.kind === "images") {
      const storeIdCol = await pickExistingColumn(client, s.table, s.storeIdColCandidates || ["store_id"]);
      if (!storeIdCol || !sid) continue;

      const orderCol = (await pickExistingColumn(client, s.table, s.updatedCandidates || ["id"])) || storeIdCol;

      const q = `
        SELECT ${imgCols[0]} AS img
        FROM ${s.table}
        WHERE ${storeIdCol}::text = $1
          AND ${imgCols[0]} IS NOT NULL
          AND ${imgCols[0]} <> ''
        ORDER BY ${orderCol} DESC
        LIMIT 1
      `;
      const r = await client.query(q, [sid]);
      const img = normalizeImageUrl(r.rows?.[0]?.img);
      if (img) return img;

      continue;
    }

    // 단일(또는 1행에서 coalesce) 테이블 처리
    const idCol = await pickExistingColumn(client, s.table, s.idCandidates);
    const bizCol = await pickExistingColumn(client, s.table, s.bizCandidates);
    const nameCol = await pickExistingColumn(client, s.table, s.nameCandidates);
    const updatedCol = await pickExistingColumn(client, s.table, s.updatedCandidates || ["updated_at"]);

    // 조건 하나도 못 만들면 스킵
    const where = [];
    const params = [];

    if (sid && idCol) {
      params.push(sid);
      where.push(`${idCol}::text = $${params.length}`);
    }
    if (bizDigits && bizCol) {
      params.push(bizDigits);
      where.push(`regexp_replace(COALESCE(${bizCol}::text,''), '[^0-9]', '', 'g') = $${params.length}`);
    }
    if (bname && nameCol) {
      params.push(bname);
      where.push(`${nameCol} ILIKE '%' || $${params.length} || '%'`);
    }

    if (!where.length) continue;

    // 대표이미지: 가능한 컬럼들 coalesce
    const coalesceExpr =
      imgCols.length >= 2
        ? `COALESCE(${imgCols.join(", ")})`
        : `${imgCols[0]}`;

    const orderExpr = updatedCol
      ? `${updatedCol} DESC`
      : (idCol ? `${idCol} DESC` : "1");

    const q = `
      SELECT ${coalesceExpr} AS img
      FROM ${s.table}
      WHERE (${where.join(" OR ")})
      ORDER BY ${orderExpr}
      LIMIT 1
    `;

    const r = await client.query(q, params);
    const img = normalizeImageUrl(r.rows?.[0]?.img);
    if (img) return img;
  }

  return null;
}

async function attachAutoStoreImage(client, slotObj) {
  if (!slotObj) return slotObj;

  const hasImage = !!cleanStr(slotObj.image_url);
  const mode = cleanStr(slotObj.slot_mode)?.toLowerCase();
  if (hasImage) return slotObj;
  if (mode !== "store") return slotObj;

  const img = await resolveStoreMainImage(client, {
    storeId: slotObj.store_id,
    businessNo: slotObj.business_no,
    businessName: slotObj.business_name,
  });

  if (img) slotObj.image_url = img;
  return slotObj;
}

/* ------------------------- 핵심: "노출 1개" 선택 ------------------------- */
async function getEffectiveSlotFromItems(client, page, position) {
  const { rows } = await client.query(
    `
    SELECT
      page, position, priority,
      image_url, link_url, text_content,
      business_no, business_name, store_id,
      slot_type, slot_mode,
      no_end, start_at, end_at,
      to_char(start_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD"T"HH24:MI') AS start_at_local,
      to_char(end_at   AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD"T"HH24:MI') AS end_at_local,
      created_at, updated_at
    FROM ${ITEMS_TABLE}
    WHERE page=$1 AND position=$2
      AND (start_at IS NULL OR start_at <= NOW())
      AND (no_end = TRUE OR end_at IS NULL OR end_at >= NOW())
    ORDER BY priority ASC, updated_at DESC, id DESC
    LIMIT 1
    `,
    [page, position]
  );
  return rows[0] || null;
}

async function getLegacySlot(client, page, position) {
  const { rows } = await client.query(
    `
    SELECT
      page, position,
      image_url, link_url, text_content,
      business_no, business_name, store_id,
      slot_type, slot_mode,
      no_end, start_at, end_at,
      to_char(start_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD"T"HH24:MI') AS start_at_local,
      to_char(end_at   AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD"T"HH24:MI') AS end_at_local,
      created_at, updated_at
    FROM ${LEGACY_TABLE}
    WHERE page=$1 AND position=$2
    LIMIT 1
    `,
    [page, position]
  );
  return rows[0] || null;
}

/* -------------------------
 *  GET /manager/ad/slot?page=index&position=best_pick_1
 * ------------------------- */
export async function getSlot(req, res) {
  const page = cleanStr(req.query.page);
  const position = cleanStr(req.query.position);
  const priority = toInt(req.query.priority);

  if (!page || !position) {
    return res.status(400).json({ success: false, error: "page, position 필수" });
  }

  const client = await pool.connect();
  try {
    const itemsOk = await tableExists(client, ITEMS_TABLE);
    const legacyOk = await tableExists(client, LEGACY_TABLE);

    // ✅ 특정 priority 편집용 조회
    if (priority && itemsOk) {
      const { rows } = await client.query(
        `
        SELECT
          page, position, priority,
          image_url, link_url, text_content,
          business_no, business_name, store_id,
          slot_type, slot_mode,
          no_end, start_at, end_at,
          to_char(start_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD"T"HH24:MI') AS start_at_local,
          to_char(end_at   AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD"T"HH24:MI') AS end_at_local,
          created_at, updated_at
        FROM ${ITEMS_TABLE}
        WHERE page=$1 AND position=$2 AND priority=$3
        LIMIT 1
        `,
        [page, position, priority]
      );

      const mapped = mapSlotRow(rows[0] || null);
      await attachAutoStoreImage(client, mapped);
      return res.json({ success: true, slot: mapped });
    }

    // ✅ 기본: 노출 1개(우선순위 후보 우선)
    if (itemsOk) {
      const row = await getEffectiveSlotFromItems(client, page, position);
      if (row) {
        const mapped = mapSlotRow(row);
        await attachAutoStoreImage(client, mapped);
        return res.json({ success: true, slot: mapped });
      }
    }

    if (legacyOk) {
      const row = await getLegacySlot(client, page, position);
      const mapped = mapSlotRow(row);
      await attachAutoStoreImage(client, mapped);
      return res.json({ success: true, slot: mapped });
    }

    return res.status(500).json({
      success: false,
      error: `테이블 없음: ${ITEMS_TABLE}, ${LEGACY_TABLE}`,
    });
  } catch (e) {
    console.error("❌ getSlot error:", e);
    return res.status(500).json({ success: false, error: "서버 오류" });
  } finally {
    client.release();
  }
}

/* -------------------------
 *  GET /manager/ad/slots?page=index
 * ------------------------- */
export async function listSlots(req, res) {
  const page = cleanStr(req.query.page);

  const client = await pool.connect();
  try {
    const itemsOk = await tableExists(client, ITEMS_TABLE);
    const legacyOk = await tableExists(client, LEGACY_TABLE);

    const map = new Map(); // key: page|position -> row

    if (itemsOk) {
      const { rows } = await client.query(
        `
        SELECT DISTINCT ON (page, position)
          page, position, priority,
          image_url, link_url, text_content,
          business_no, business_name, store_id,
          slot_type, slot_mode,
          no_end, start_at, end_at,
          to_char(start_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD"T"HH24:MI') AS start_at_local,
          to_char(end_at   AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD"T"HH24:MI') AS end_at_local,
          created_at, updated_at
        FROM ${ITEMS_TABLE}
        WHERE (${page ? "page = $1" : "TRUE"})
          AND (start_at IS NULL OR start_at <= NOW())
          AND (no_end = TRUE OR end_at IS NULL OR end_at >= NOW())
        ORDER BY page, position, priority ASC, updated_at DESC, id DESC
        `,
        page ? [page] : []
      );

      for (const r of rows) {
        map.set(`${r.page}|${r.position}`, mapSlotRow(r));
      }
    }

    if (legacyOk) {
      const { rows } = await client.query(
        `
        SELECT
          page, position,
          image_url, link_url, text_content,
          business_no, business_name, store_id,
          slot_type, slot_mode,
          no_end, start_at, end_at,
          to_char(start_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD"T"HH24:MI') AS start_at_local,
          to_char(end_at   AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD"T"HH24:MI') AS end_at_local,
          created_at, updated_at
        FROM ${LEGACY_TABLE}
        ${page ? "WHERE page = $1" : ""}
        ORDER BY page, position
        `,
        page ? [page] : []
      );

      for (const r of rows) {
        const key = `${r.page}|${r.position}`;
        if (!map.has(key)) map.set(key, mapSlotRow(r));
      }
    }

    // ✅ 응답 보정: store 슬롯인데 image_url 없으면 가게 대표이미지 자동 첨부
    const slots = Array.from(map.values());
    for (const s of slots) {
      await attachAutoStoreImage(client, s);
    }

    return res.json({ success: true, slots });
  } catch (e) {
    console.error("❌ listSlots error:", e);
    return res.status(500).json({ success: false, error: "서버 오류" });
  } finally {
    client.release();
  }
}

/* -------------------------
 *  GET /manager/ad/slot-items?page=index&position=best_pick_1
 * ------------------------- */
export async function listSlotItems(req, res) {
  const page = cleanStr(req.query.page);
  const position = cleanStr(req.query.position);

  if (!page || !position) {
    return res.status(400).json({ success: false, error: "page, position 필수" });
  }

  const client = await pool.connect();
  try {
    const itemsOk = await tableExists(client, ITEMS_TABLE);
    if (!itemsOk) {
      return res.status(500).json({
        success: false,
        error: `테이블 없음: ${ITEMS_TABLE} (Neon SQL 실행 필요)`,
      });
    }

    const { rows } = await client.query(
      `
      SELECT
        page, position, priority,
        image_url, link_url, text_content,
        business_no, business_name, store_id,
        slot_type, slot_mode,
        no_end, start_at, end_at,
        to_char(start_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD"T"HH24:MI') AS start_at_local,
        to_char(end_at   AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD"T"HH24:MI') AS end_at_local,
        created_at, updated_at
      FROM ${ITEMS_TABLE}
      WHERE page=$1 AND position=$2
      ORDER BY priority ASC, updated_at DESC, id DESC
      `,
      [page, position]
    );

    const items = rows.map(mapSlotRow);
    for (const it of items) {
      await attachAutoStoreImage(client, it);
    }

    return res.json({ success: true, items });
  } catch (e) {
    console.error("❌ listSlotItems error:", e);
    return res.status(500).json({ success: false, error: "서버 오류" });
  } finally {
    client.release();
  }
}

/* -------------------------
 *  POST /manager/ad/slot  (multipart/form-data)
 *  ✅ 슬롯 이미지 없으면 "가게 대표이미지" 자동 대입
 * ------------------------- */
export async function upsertSlot(req, res) {
  ensureUploadDir();

  const body = pickBody(req);
  const {
    page, position, priority,
    slotType, slotMode,
    linkUrl, textContent,
    storeId, businessNo, businessName,
    startAt, endAt, noEnd,
    keepImage, clearImage,
  } = body;

  if (!page || !position) {
    return res.status(400).json({ success: false, error: "page, position 필수" });
  }

  const file = pickUploadFile(req);
  const client = await pool.connect();

  try {
    const itemsOk = await tableExists(client, ITEMS_TABLE);
    const legacyOk = await tableExists(client, LEGACY_TABLE);

    const modeLower = cleanStr(slotMode)?.toLowerCase();

    // ✅ 후보 저장 모드(priority가 있으면 무조건 후보 테이블)
    if (priority) {
      if (!itemsOk) {
        return res.status(500).json({
          success: false,
          error: `테이블 없음: ${ITEMS_TABLE} (Neon SQL 실행 필요)`,
        });
      }

      // 기존 후보 이미지
      const prev = await client.query(
        `SELECT image_url FROM ${ITEMS_TABLE} WHERE page=$1 AND position=$2 AND priority=$3 LIMIT 1`,
        [page, position, priority]
      );
      const prevImageUrl = prev.rows?.[0]?.image_url ?? null;

      // 이미지 결정 로직
      let nextImageUrl = prevImageUrl;

      if (clearImage) nextImageUrl = null;

      if (file) {
        nextImageUrl = `${UPLOAD_PUBLIC_PREFIX}/${file.filename}`;
      } else if (keepImage) {
        nextImageUrl = prevImageUrl;
      } else {
        // ✅ 파일도 없고 기존도 없고, store 슬롯이면 가게 대표이미지 자동 대입
        if (!cleanStr(nextImageUrl) && modeLower === "store") {
          const autoImg = await resolveStoreMainImage(client, {
            storeId,
            businessNo,
            businessName,
          });
          if (autoImg) nextImageUrl = autoImg;
        }
      }

      const startAtTz = toKstTimestamptz(startAt);
      const endAtTz = noEnd ? null : toKstTimestamptz(endAt);

      const { rows } = await client.query(
        `
        INSERT INTO ${ITEMS_TABLE} (
          page, position, priority,
          image_url, link_url, text_content,
          business_no, business_name, store_id,
          slot_type, slot_mode,
          start_at, end_at, no_end,
          created_at, updated_at
        )
        VALUES (
          $1,$2,$3,
          $4,$5,$6,
          $7,$8,$9,
          $10,$11,
          $12,$13,$14,
          NOW(), NOW()
        )
        ON CONFLICT (page, position, priority)
        DO UPDATE SET
          image_url     = EXCLUDED.image_url,
          link_url      = EXCLUDED.link_url,
          text_content  = EXCLUDED.text_content,
          business_no   = EXCLUDED.business_no,
          business_name = EXCLUDED.business_name,
          store_id      = EXCLUDED.store_id,
          slot_type     = EXCLUDED.slot_type,
          slot_mode     = EXCLUDED.slot_mode,
          start_at      = EXCLUDED.start_at,
          end_at        = EXCLUDED.end_at,
          no_end        = EXCLUDED.no_end,
          updated_at    = NOW()
        RETURNING
          page, position, priority,
          image_url, link_url, text_content,
          business_no, business_name, store_id,
          slot_type, slot_mode,
          no_end, start_at, end_at,
          to_char(start_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD"T"HH24:MI') AS start_at_local,
          to_char(end_at   AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD"T"HH24:MI') AS end_at_local,
          created_at, updated_at
        `,
        [
          page, position, priority,
          nextImageUrl, linkUrl, textContent,
          businessNo, businessName, storeId,
          slotType, slotMode,
          startAtTz, endAtTz, noEnd,
        ]
      );

      const mapped = mapSlotRow(rows[0]);
      return res.json({ success: true, slot: mapped });
    }

    // ✅ legacy 저장(기존 방식)
    if (!legacyOk) {
      return res.status(500).json({
        success: false,
        error: `테이블 없음: ${LEGACY_TABLE} (Neon에서 생성 필요)`,
      });
    }

    const prev = await client.query(
      `SELECT image_url FROM ${LEGACY_TABLE} WHERE page=$1 AND position=$2 LIMIT 1`,
      [page, position]
    );
    const prevImageUrl = prev.rows?.[0]?.image_url ?? null;

    let nextImageUrl = prevImageUrl;

    if (clearImage) nextImageUrl = null;

    if (file) {
      nextImageUrl = `${UPLOAD_PUBLIC_PREFIX}/${file.filename}`;
    } else if (keepImage) {
      nextImageUrl = prevImageUrl;
    } else {
      // ✅ 파일도 없고 기존도 없고, store 슬롯이면 가게 대표이미지 자동 대입
      if (!cleanStr(nextImageUrl) && modeLower === "store") {
        const autoImg = await resolveStoreMainImage(client, {
          storeId,
          businessNo,
          businessName,
        });
        if (autoImg) nextImageUrl = autoImg;
      }
    }

    const startAtTz = toKstTimestamptz(startAt);
    const endAtTz = noEnd ? null : toKstTimestamptz(endAt);

    const { rows } = await client.query(
      `
      INSERT INTO ${LEGACY_TABLE} (
        page, position,
        image_url, link_url, text_content,
        business_no, business_name, store_id,
        slot_type, slot_mode,
        start_at, end_at, no_end,
        created_at, updated_at
      )
      VALUES (
        $1,$2,
        $3,$4,$5,
        $6,$7,$8,
        $9,$10,
        $11,$12,$13,
        NOW(), NOW()
      )
      ON CONFLICT (page, position)
      DO UPDATE SET
        image_url     = EXCLUDED.image_url,
        link_url      = EXCLUDED.link_url,
        text_content  = EXCLUDED.text_content,
        business_no   = EXCLUDED.business_no,
        business_name = EXCLUDED.business_name,
        store_id      = EXCLUDED.store_id,
        slot_type     = EXCLUDED.slot_type,
        slot_mode     = EXCLUDED.slot_mode,
        start_at      = EXCLUDED.start_at,
        end_at        = EXCLUDED.end_at,
        no_end        = EXCLUDED.no_end,
        updated_at    = NOW()
      RETURNING
        page, position,
        image_url, link_url, text_content,
        business_no, business_name, store_id,
        slot_type, slot_mode,
        no_end, start_at, end_at,
        to_char(start_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD"T"HH24:MI') AS start_at_local,
        to_char(end_at   AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD"T"HH24:MI') AS end_at_local,
        created_at, updated_at
      `,
      [
        page, position,
        nextImageUrl, linkUrl, textContent,
        businessNo, businessName, storeId,
        slotType, slotMode,
        startAtTz, endAtTz, noEnd,
      ]
    );

    const mapped = mapSlotRow(rows[0]);
    return res.json({ success: true, slot: mapped });
  } catch (e) {
    console.error("❌ upsertSlot error:", e);
    return res.status(500).json({ success: false, error: "서버 오류" });
  } finally {
    client.release();
  }
}

/* -------------------------
 *  DELETE /manager/ad/slot?page=index&position=...&priority=2
 * ------------------------- */
export async function deleteSlot(req, res) {
  const page = cleanStr(req.query.page);
  const position = cleanStr(req.query.position);
  const priority = toInt(req.query.priority);

  if (!page || !position) {
    return res.status(400).json({ success: false, error: "page, position 필수" });
  }

  const client = await pool.connect();
  try {
    const itemsOk = await tableExists(client, ITEMS_TABLE);
    const legacyOk = await tableExists(client, LEGACY_TABLE);

    if (priority) {
      if (!itemsOk) {
        return res.status(500).json({
          success: false,
          error: `테이블 없음: ${ITEMS_TABLE}`,
        });
      }
      await client.query(
        `DELETE FROM ${ITEMS_TABLE} WHERE page=$1 AND position=$2 AND priority=$3`,
        [page, position, priority]
      );
      return res.json({ success: true });
    }

    if (!legacyOk) {
      return res.status(500).json({
        success: false,
        error: `테이블 없음: ${LEGACY_TABLE}`,
      });
    }

    await client.query(`DELETE FROM ${LEGACY_TABLE} WHERE page=$1 AND position=$2`, [page, position]);
    return res.json({ success: true });
  } catch (e) {
    console.error("❌ deleteSlot error:", e);
    return res.status(500).json({ success: false, error: "서버 오류" });
  } finally {
    client.release();
  }
}

/* -------------------------
 *  GET /manager/ad/store/search?bizNo=...  or  ?q=...
 * ------------------------- */
export async function searchStore(req, res) {
  const bizNo = cleanStr(req.query.bizNo ?? req.query.businessNo ?? req.query.business_no);

  // ✅ 프론트가 name/businessName을 보내도 검색되게 흡수
  const q = cleanStr(
    req.query.q ??
    req.query.keyword ??
    req.query.name ??
    req.query.businessName ??
    req.query.business_name
  );

  const client = await pool.connect();
  try {
    const sources = [
      {
        table: "public.combined_store_info",
        idCandidates: ["id", "store_id"],
        bizCandidates: ["business_number", "business_no", "businessno", "biz_no", "bizno", "business_num", "b_no", "bno"],
        nameCandidates: ["business_name", "store_name", "name", "title"],
      },
      {
        table: "public.store_info",
        idCandidates: ["id", "store_id"],
        bizCandidates: ["business_no", "businessno", "biz_no", "bizno", "business_number", "business_num", "b_no", "bno"],
        nameCandidates: ["business_name", "store_name", "name", "title"],
      },
      {
        table: "public.food_stores",
        idCandidates: ["id", "store_id"],
        bizCandidates: ["business_no", "businessno", "biz_no", "bizno", "business_number", "business_num", "b_no", "bno"],
        nameCandidates: ["store_name", "business_name", "name", "title"],
      },
    ];

    const found = [];

    async function runSearch({ table, idCandidates, bizCandidates, nameCandidates }, mode, value) {
      const ok = await tableExists(client, table);
      if (!ok) return;

      const idCol = await pickExistingColumn(client, table, idCandidates);
      const bizCol = await pickExistingColumn(client, table, bizCandidates);
      const nameCol = await pickExistingColumn(client, table, nameCandidates);

      if (!idCol || !nameCol || !bizCol) return;

      if (mode === "biz") {
        const r = await client.query(
          `
          SELECT
            ${idCol}::text        AS id,
            ${bizCol}::text       AS business_no,
            ${nameCol}            AS business_name
          FROM ${table}
          WHERE ${bizCol}::text = $1
          ORDER BY ${idCol} DESC
          LIMIT 30
          `,
          [value]
        );
        found.push(...r.rows);
        return;
      }

      if (mode === "q") {
        const r = await client.query(
          `
          SELECT
            ${idCol}::text        AS id,
            ${bizCol}::text       AS business_no,
            ${nameCol}            AS business_name
          FROM ${table}
          WHERE ${nameCol} ILIKE '%' || $1 || '%'
             OR ${bizCol}::text ILIKE '%' || $1 || '%'
          ORDER BY ${idCol} DESC
          LIMIT 30
          `,
          [value]
        );
        found.push(...r.rows);
      }
    }

    // 1) bizNo로 먼저 검색
    if (bizNo) {
      for (const s of sources) await runSearch(s, "biz", bizNo);
    }

    // 2) bizNo로 못 찾으면 q로 검색
    if (!found.length && q) {
      for (const s of sources) await runSearch(s, "q", q);
    }

    const uniq = new Map();
    for (const s of found) {
      const key = `${s.id}|${s.business_no}|${s.business_name}`;
      if (!uniq.has(key)) uniq.set(key, s);
    }

    return res.json({ ok: true, stores: Array.from(uniq.values()) });
  } catch (e) {
    console.error("❌ searchStore error:", e);
    return res.status(500).json({ ok: false, error: "서버 오류" });
  } finally {
    client.release();
  }
}

/* -------------------------
 *  multer helper (라우터에서 사용)
 * ------------------------- */
export function makeMulterStorage() {
  ensureUploadDir();
  return {
    destination: (req, file, cb) => cb(null, UPLOAD_ABS_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase();
      const safeExt = ext && ext.length <= 10 ? ext : "";
      const name = `${Date.now()}-${crypto.randomUUID()}${safeExt}`;
      cb(null, name);
    },
  };
}

export function fileFilter(req, file, cb) {
  const allowed = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"];
  if (allowed.includes(file.mimetype)) return cb(null, true);
  return cb(new Error("이미지 파일만 업로드 가능(png/jpg/webp/gif)"), false);
}
