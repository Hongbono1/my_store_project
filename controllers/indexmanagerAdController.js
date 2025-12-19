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

// ✅ 다른 모듈들도 /data/uploads 아래 저장한다고 가정
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

  // 이미 tz 들어있으면 그대로
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

  // 절대 URL이면 그대로
  if (/^https?:\/\//i.test(s)) return s;

  // /data/uploads/... 로 저장돼있으면 /uploads/... 로 변환
  if (s.startsWith(`${DATA_UPLOAD_ROOT}/`)) {
    return `/uploads/${s.slice(`${DATA_UPLOAD_ROOT}/`.length)}`;
  }

  // uploads/... 형태면 /uploads/... 로
  if (s.startsWith("uploads/")) return `/${s}`;

  // /uploads/... 형태면 그대로
  if (s.startsWith("/uploads/")) return s;

  // 그 외: /로 시작하면 그대로, 아니면 /uploads/ 붙임
  if (s.startsWith("/")) return s;
  return `/uploads/${s}`;
}

function normalizeStoreType(v) {
  const s = cleanStr(v);
  if (!s) return null;
  const t = s.toLowerCase();
  // 네 프로젝트에서 쓰는 타입명만 여기서 통일
  if (t === "food" || t === "combined" || t === "store_info") return t;
  return t; // 기타도 그대로 보존
}

function pickBody(req) {
  const b = req?.body || {};

  const rawSlotType = cleanStr(b.slotType ?? b.slot_type);
  const rawSlotMode = cleanStr(b.slotMode ?? b.slot_mode);

  // ✅ 기본값 강제(프론트 누락/오타 대비)
  const slotType = (rawSlotType || "banner").toLowerCase();
  const slotMode = (rawSlotMode || "image").toLowerCase();

  return {
    page: cleanStr(b.page),
    position: cleanStr(b.position),

    // ✅ 우선순위 (후보 저장 모드)
    priority: toInt(b.priority),

    // 타입/모드
    slotType,
    slotMode,

    // 링크/텍스트
    linkUrl: cleanStr(b.linkUrl ?? b.link_url ?? b.link),
    textContent: cleanStr(b.textContent ?? b.text_content ?? b.content),

    // 가게 연결
    storeId: cleanStr(b.storeId ?? b.store_id),
    businessNo: digitsOnly(b.businessNo ?? b.business_no ?? b.bizNo ?? b.biz_no),
    businessName: cleanStr(b.businessName ?? b.business_name),

    // ✅ store_type 추가
    storeType: normalizeStoreType(b.storeType ?? b.store_type ?? b.detail_type),

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
    priority: r.priority ?? null,

    image_url: normalizeImageUrl(r.image_url),
    link_url: r.link_url ?? null,
    text_content: r.text_content ?? null,

    business_no: r.business_no ?? null,
    business_name: r.business_name ?? null,
    store_id: r.store_id ?? null,

    slot_type: r.slot_type ?? null,
    slot_mode: r.slot_mode ?? null,

    // ✅ store_type 포함
    store_type: r.store_type ?? null,

    no_end: r.no_end ?? false,
    start_at: r.start_at ?? null,
    end_at: r.end_at ?? null,
    start_at_local: r.start_at_local ?? null,
    end_at_local: r.end_at_local ?? null,

    created_at: r.created_at ?? null,
    updated_at: r.updated_at ?? null,
  };
}

/** ✅ 업로드 파일(라우터 fields 대응) */
function pickUploadFile(req) {
  if (req.file) return req.file;

  // ✅ upload.any() 사용 시: req.files는 배열
  if (Array.isArray(req.files) && req.files.length) {
    return req.files[0];
  }

  // ✅ fields 사용 시: req.files는 객체
  const f = req.files || {};
  return f.image?.[0] || f.slotImage?.[0] || f.file?.[0] || null;
}

/* -------------------------
 *  공통: 컬럼 존재 확인 유틸
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
 * ✅ store 모드일 때, 슬롯 이미지가 없으면 자동 대표이미지 찾기
 * ✅ store_type 있으면 우선순위로 테이블 선택
 * ------------------------- */
async function resolveStoreMainImage(client, { storeType, storeId, businessNo, businessName }) {
  const sid = cleanStr(storeId);
  const bizDigits = digitsOnly(businessNo);
  const bname = cleanStr(businessName);
  const st = normalizeStoreType(storeType);

  // store_type 기반 우선순위
  const ordered = [];
  const push = (x) => ordered.push(x);

  // 공통 소스 정의
  const SRC = {
    combined_info: {
      table: "public.combined_store_info",
      idCandidates: ["id", "store_id"],
      bizCandidates: ["business_number", "business_no", "biz_no", "bizno", "b_no", "bno"],
      nameCandidates: ["business_name", "store_name", "name", "title"],
      imgCandidates: [
        "main_image_url",
        "main_img",
        "image_url",
        "cover_image",
        "image_path",
        "image1",
        "image2",
        "image3",
      ],
      updatedCandidates: ["updated_at", "modified_at", "created_at", "id"],
      kind: "single",
    },
    store_info: {
      table: "public.store_info",
      idCandidates: ["id", "store_id"],
      bizCandidates: ["business_number", "business_no", "biz_no", "bizno", "b_no", "bno"],
      nameCandidates: ["business_name", "store_name", "name", "title"],
      imgCandidates: ["main_image_url", "main_img", "image_url", "image_path", "image1", "image2", "image3"],
      updatedCandidates: ["updated_at", "modified_at", "created_at", "id"],
      kind: "single",
    },
    food_stores: {
      table: "public.food_stores",
      idCandidates: ["id", "store_id"],
      bizCandidates: ["business_number", "business_no", "biz_no", "bizno", "b_no", "bno"],
      nameCandidates: ["store_name", "business_name", "name", "title"],
      imgCandidates: ["main_image_url", "main_img", "image_url", "image_path", "image1", "image2", "image3"],
      updatedCandidates: ["updated_at", "modified_at", "created_at", "id"],
      kind: "single",
    },
    combined_images: {
      table: "public.combined_store_images",
      storeIdColCandidates: ["store_id"],
      imgCandidates: ["image_url", "image_path", "file_path", "url"],
      updatedCandidates: ["updated_at", "created_at", "id"],
      kind: "images",
    },
    store_images: {
      table: "public.store_images",
      storeIdColCandidates: ["store_id"],
      imgCandidates: ["image_url", "image_path", "file_path", "url"],
      updatedCandidates: ["updated_at", "created_at", "id"],
      kind: "images",
    },
    food_images: {
      table: "public.food_store_images",
      storeIdColCandidates: ["store_id"],
      imgCandidates: ["image_url", "image_path", "file_path", "url"],
      updatedCandidates: ["updated_at", "created_at", "id"],
      kind: "images",
    },
  };

  // ✅ store_type 우선 순서
  if (st === "food") {
    push(SRC.food_stores);
    push(SRC.food_images);
    push(SRC.combined_info);
    push(SRC.combined_images);
    push(SRC.store_info);
    push(SRC.store_images);
  } else if (st === "combined") {
    push(SRC.combined_info);
    push(SRC.combined_images);
    push(SRC.store_info);
    push(SRC.store_images);
    push(SRC.food_stores);
    push(SRC.food_images);
  } else if (st === "store_info") {
    push(SRC.store_info);
    push(SRC.store_images);
    push(SRC.combined_info);
    push(SRC.combined_images);
    push(SRC.food_stores);
    push(SRC.food_images);
  } else {
    // 타입 모르면 기존처럼 넓게
    push(SRC.combined_info);
    push(SRC.store_info);
    push(SRC.food_stores);
    push(SRC.food_images);
    push(SRC.store_images);
    push(SRC.combined_images);
  }

  for (const s of ordered) {
    const ok = await tableExists(client, s.table);
    if (!ok) continue;

    const imgCols = await pickExistingColumns(client, s.table, s.imgCandidates);
    if (!imgCols.length) continue;

    // 이미지 다건 테이블
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

    // 단일 테이블
    const idCol = await pickExistingColumn(client, s.table, s.idCandidates);
    const bizCol = await pickExistingColumn(client, s.table, s.bizCandidates);
    const nameCol = await pickExistingColumn(client, s.table, s.nameCandidates);
    const updatedCol = await pickExistingColumn(client, s.table, s.updatedCandidates || ["updated_at"]);

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

    const coalesceExpr = imgCols.length >= 2 ? `COALESCE(${imgCols.join(", ")})` : `${imgCols[0]}`;
    const orderExpr = updatedCol ? `${updatedCol} DESC` : idCol ? `${idCol} DESC` : "1";

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
  const type = cleanStr(slotObj.slot_type)?.toLowerCase();

  // ✅ text 슬롯은 이미지 자동대입 금지
  if (type === "text") return slotObj;

  // store 모드 + 이미지 없음일 때만 자동 보정
  if (hasImage) return slotObj;
  if (mode !== "store") return slotObj;

  const img = await resolveStoreMainImage(client, {
    storeType: slotObj.store_type,
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
      slot_type, slot_mode,
      image_url, link_url, text_content,
      store_type, store_id,
      business_no, business_name,
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
  // legacy에 store_type 컬럼이 없을 수도 있으니 안전하게 처리
  const legacyStoreTypeCol = await pickExistingColumn(client, LEGACY_TABLE, ["store_type"]);
  const storeTypeSel = legacyStoreTypeCol ? `${legacyStoreTypeCol} AS store_type` : `NULL::text AS store_type`;

  const { rows } = await client.query(
    `
    SELECT
      page, position,
      slot_type, slot_mode,
      image_url, link_url, text_content,
      store_id, business_no, business_name,
      ${storeTypeSel},
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
 *  GET /manager/ad/slot?page=index&position=...
 *  (priority 있으면 후보 1개 편집용 조회)
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

    // ✅ 특정 priority 편집용
    if (priority && itemsOk) {
      const { rows } = await client.query(
        `
        SELECT
          page, position, priority,
          slot_type, slot_mode,
          image_url, link_url, text_content,
          store_type, store_id,
          business_no, business_name,
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

    // ✅ 노출 1개 (후보 테이블 우선)
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
 *  (각 position별 노출 1개씩)
 * ------------------------- */
export async function listSlots(req, res) {
  const page = cleanStr(req.query.page);

  const client = await pool.connect();
  try {
    const itemsOk = await tableExists(client, ITEMS_TABLE);
    const legacyOk = await tableExists(client, LEGACY_TABLE);

    const map = new Map(); // key: page|position -> slot

    if (itemsOk) {
      const { rows } = await client.query(
        `
        SELECT DISTINCT ON (page, position)
          page, position, priority,
          slot_type, slot_mode,
          image_url, link_url, text_content,
          store_type, store_id,
          business_no, business_name,
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
      const legacyStoreTypeCol = await pickExistingColumn(client, LEGACY_TABLE, ["store_type"]);
      const storeTypeSel = legacyStoreTypeCol ? `${legacyStoreTypeCol} AS store_type` : `NULL::text AS store_type`;

      const { rows } = await client.query(
        `
        SELECT
          page, position,
          slot_type, slot_mode,
          image_url, link_url, text_content,
          store_id, business_no, business_name,
          ${storeTypeSel},
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
 *  GET /manager/ad/slot-items?page=index&position=...
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
        error: `테이블 없음: ${ITEMS_TABLE}`,
      });
    }

    const { rows } = await client.query(
      `
      SELECT
        page, position, priority,
        slot_type, slot_mode,
        image_url, link_url, text_content,
        store_type, store_id,
        business_no, business_name,
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
 *  POST /manager/ad/slot (multipart/form-data)
 *  - priority 있으면 후보테이블(admin_ad_slot_items) 저장
 *  - priority 없으면 legacy(admin_ad_slots) 저장
 * ------------------------- */
export async function upsertSlot(req, res) {
  ensureUploadDir();

  const body = pickBody(req);
  const {
    page,
    position,
    priority,
    slotType,
    slotMode,
    linkUrl,
    textContent,
    storeId,
    businessNo,
    businessName,
    storeType,
    startAt,
    endAt,
    noEnd,
    keepImage,
    clearImage,
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
    const typeLower = cleanStr(slotType)?.toLowerCase();
    const isTextSlot = typeLower === "text";

    // ✅ 후보 저장 (priority 있으면 무조건 후보 테이블)
    if (priority) {
      if (!itemsOk) {
        return res.status(500).json({
          success: false,
          error: `테이블 없음: ${ITEMS_TABLE}`,
        });
      }

      const prev = await client.query(
        `SELECT image_url FROM ${ITEMS_TABLE} WHERE page=$1 AND position=$2 AND priority=$3 LIMIT 1`,
        [page, position, priority]
      );
      const prevImageUrl = normalizeImageUrl(prev.rows?.[0]?.image_url ?? null);

      let nextImageUrl = prevImageUrl;

      if (clearImage) nextImageUrl = null;

      if (file) {
        nextImageUrl = `${UPLOAD_PUBLIC_PREFIX}/${file.filename}`;
      } else if (keepImage) {
        nextImageUrl = prevImageUrl;
      } else {
        if (!isTextSlot && !cleanStr(nextImageUrl) && modeLower === "store") {
          const autoImg = await resolveStoreMainImage(client, {
            storeType,
            storeId,
            businessNo,
            businessName,
          });
          if (autoImg) nextImageUrl = autoImg;
        }
      }

      if (isTextSlot) nextImageUrl = null;

      const startAtTz = toKstTimestamptz(startAt);
      const endAtTz = noEnd ? null : toKstTimestamptz(endAt);

      const { rows } = await client.query(
        `
        INSERT INTO ${ITEMS_TABLE} (
          page, position, priority,
          slot_type, slot_mode,
          image_url, link_url, text_content,
          store_type, store_id,
          business_no, business_name,
          start_at, end_at, no_end,
          created_at, updated_at
        )
        VALUES (
          $1,$2,$3,
          $4,$5,
          $6,$7,$8,
          $9,$10,
          $11,$12,
          $13,$14,$15,
          NOW(), NOW()
        )
        ON CONFLICT (page, position, priority)
        DO UPDATE SET
          slot_type     = EXCLUDED.slot_type,
          slot_mode     = EXCLUDED.slot_mode,
          image_url     = EXCLUDED.image_url,
          link_url      = EXCLUDED.link_url,
          text_content  = EXCLUDED.text_content,
          store_type    = EXCLUDED.store_type,
          store_id      = EXCLUDED.store_id,
          business_no   = EXCLUDED.business_no,
          business_name = EXCLUDED.business_name,
          start_at      = EXCLUDED.start_at,
          end_at        = EXCLUDED.end_at,
          no_end        = EXCLUDED.no_end,
          updated_at    = NOW()
        RETURNING
          page, position, priority,
          slot_type, slot_mode,
          image_url, link_url, text_content,
          store_type, store_id,
          business_no, business_name,
          no_end, start_at, end_at,
          to_char(start_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD"T"HH24:MI') AS start_at_local,
          to_char(end_at   AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD"T"HH24:MI') AS end_at_local,
          created_at, updated_at
        `,
        [
          page,
          position,
          priority,
          slotType,
          slotMode,
          isTextSlot ? null : normalizeImageUrl(nextImageUrl),
          linkUrl,
          textContent,
          storeType,
          storeId,
          businessNo,
          businessName,
          startAtTz,
          endAtTz,
          noEnd,
        ]
      );

      const mapped = mapSlotRow(rows[0]);
      return res.json({ success: true, slot: mapped });
    }

    // ✅ legacy 저장
    if (!legacyOk) {
      return res.status(500).json({
        success: false,
        error: `테이블 없음: ${LEGACY_TABLE}`,
      });
    }

    const prev = await client.query(
      `SELECT image_url FROM ${LEGACY_TABLE} WHERE page=$1 AND position=$2 LIMIT 1`,
      [page, position]
    );
    const prevImageUrl = normalizeImageUrl(prev.rows?.[0]?.image_url ?? null);

    let nextImageUrl = prevImageUrl;

    if (clearImage) nextImageUrl = null;

    if (file) {
      nextImageUrl = `${UPLOAD_PUBLIC_PREFIX}/${file.filename}`;
    } else if (keepImage) {
      nextImageUrl = prevImageUrl;
    } else {
      if (!isTextSlot && !cleanStr(nextImageUrl) && modeLower === "store") {
        const autoImg = await resolveStoreMainImage(client, {
          storeType,
          storeId,
          businessNo,
          businessName,
        });
        if (autoImg) nextImageUrl = autoImg;
      }
    }

    if (isTextSlot) nextImageUrl = null;

    const startAtTz = toKstTimestamptz(startAt);
    const endAtTz = noEnd ? null : toKstTimestamptz(endAt);

    // legacy에 store_type 컬럼이 없을 수 있으니 동적 처리
    const legacyStoreTypeCol = await pickExistingColumn(client, LEGACY_TABLE, ["store_type"]);

    if (legacyStoreTypeCol) {
      const { rows } = await client.query(
        `
        INSERT INTO ${LEGACY_TABLE} (
          page, position,
          slot_type, slot_mode,
          image_url, link_url, text_content,
          store_type, store_id,
          business_no, business_name,
          start_at, end_at, no_end,
          created_at, updated_at
        )
        VALUES (
          $1,$2,
          $3,$4,
          $5,$6,$7,
          $8,$9,
          $10,$11,
          $12,$13,$14,
          NOW(), NOW()
        )
        ON CONFLICT (page, position)
        DO UPDATE SET
          slot_type     = EXCLUDED.slot_type,
          slot_mode     = EXCLUDED.slot_mode,
          image_url     = EXCLUDED.image_url,
          link_url      = EXCLUDED.link_url,
          text_content  = EXCLUDED.text_content,
          store_type    = EXCLUDED.store_type,
          store_id      = EXCLUDED.store_id,
          business_no   = EXCLUDED.business_no,
          business_name = EXCLUDED.business_name,
          start_at      = EXCLUDED.start_at,
          end_at        = EXCLUDED.end_at,
          no_end        = EXCLUDED.no_end,
          updated_at    = NOW()
        RETURNING
          page, position,
          slot_type, slot_mode,
          image_url, link_url, text_content,
          store_type, store_id,
          business_no, business_name,
          no_end, start_at, end_at,
          to_char(start_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD"T"HH24:MI') AS start_at_local,
          to_char(end_at   AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD"T"HH24:MI') AS end_at_local,
          created_at, updated_at
        `,
        [
          page,
          position,
          slotType,
          slotMode,
          isTextSlot ? null : normalizeImageUrl(nextImageUrl),
          linkUrl,
          textContent,
          storeType,
          storeId,
          businessNo,
          businessName,
          startAtTz,
          endAtTz,
          noEnd,
        ]
      );

      const mapped = mapSlotRow(rows[0]);
      return res.json({ success: true, slot: mapped });
    }

    // legacy에 store_type 컬럼이 없으면 store_type 없이 저장
    const { rows } = await client.query(
      `
      INSERT INTO ${LEGACY_TABLE} (
        page, position,
        slot_type, slot_mode,
        image_url, link_url, text_content,
        store_id, business_no, business_name,
        start_at, end_at, no_end,
        created_at, updated_at
      )
      VALUES (
        $1,$2,
        $3,$4,
        $5,$6,$7,
        $8,$9,$10,
        $11,$12,$13,
        NOW(), NOW()
      )
      ON CONFLICT (page, position)
      DO UPDATE SET
        slot_type     = EXCLUDED.slot_type,
        slot_mode     = EXCLUDED.slot_mode,
        image_url     = EXCLUDED.image_url,
        link_url      = EXCLUDED.link_url,
        text_content  = EXCLUDED.text_content,
        store_id      = EXCLUDED.store_id,
        business_no   = EXCLUDED.business_no,
        business_name = EXCLUDED.business_name,
        start_at      = EXCLUDED.start_at,
        end_at        = EXCLUDED.end_at,
        no_end        = EXCLUDED.no_end,
        updated_at    = NOW()
      RETURNING
        page, position,
        slot_type, slot_mode,
        image_url, link_url, text_content,
        store_id, business_no, business_name,
        no_end, start_at, end_at,
        to_char(start_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD"T"HH24:MI') AS start_at_local,
        to_char(end_at   AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD"T"HH24:MI') AS end_at_local,
        created_at, updated_at
      `,
      [
        page,
        position,
        slotType,
        slotMode,
        isTextSlot ? null : normalizeImageUrl(nextImageUrl),
        linkUrl,
        textContent,
        storeId,
        businessNo,
        businessName,
        startAtTz,
        endAtTz,
        noEnd,
      ]
    );

    const mapped = mapSlotRow({ ...rows[0], store_type: null });
    return res.json({ success: true, slot: mapped });
  } catch (e) {
    console.error("❌ upsertSlot error:", e);
    return res.status(500).json({ success: false, error: "서버 오류" });
  } finally {
    client.release();
  }
}

/* -------------------------
 *  DELETE /manager/ad/slot?page=...&position=...&priority=...
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
        return res.status(500).json({ success: false, error: `테이블 없음: ${ITEMS_TABLE}` });
      }
      await client.query(
        `DELETE FROM ${ITEMS_TABLE} WHERE page=$1 AND position=$2 AND priority=$3`,
        [page, position, priority]
      );
      return res.json({ success: true });
    }

    if (!legacyOk) {
      return res.status(500).json({ success: false, error: `테이블 없음: ${LEGACY_TABLE}` });
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
 *  GET /manager/ad/store/search?bizNo=... or ?q=...
 *  ✅ 결과에 store_type도 넣어서 프론트가 그대로 저장 가능하게
 * ------------------------- */
export async function searchStore(req, res) {
  const bizNoDigits = digitsOnly(req.query.bizNo ?? req.query.businessNo ?? req.query.business_no);

  const q = cleanStr(
    req.query.q ??
      req.query.keyword ??
      req.query.name ??
      req.query.businessName ??
      req.query.business_name
  );

  const qDigits = digitsOnly(q);

  const client = await pool.connect();
  try {
    const sources = [
      {
        storeType: "combined",
        table: "public.combined_store_info",
        idCandidates: ["id", "store_id"],
        bizCandidates: ["business_number", "business_no", "biz_no", "bizno", "b_no", "bno"],
        nameCandidates: ["business_name", "store_name", "name", "title"],
      },
      {
        storeType: "store_info",
        table: "public.store_info",
        idCandidates: ["id", "store_id"],
        bizCandidates: ["business_number", "business_no", "biz_no", "bizno", "b_no", "bno"],
        nameCandidates: ["business_name", "store_name", "name", "title"],
      },
      {
        storeType: "food",
        table: "public.food_stores",
        idCandidates: ["id", "store_id"],
        bizCandidates: ["business_number", "business_no", "biz_no", "bizno", "b_no", "bno"],
        nameCandidates: ["store_name", "business_name", "name", "title"],
      },
    ];

    const found = [];

    async function runSearch(src, mode, value) {
      const { table, idCandidates, bizCandidates, nameCandidates, storeType } = src;

      const ok = await tableExists(client, table);
      if (!ok) return;

      const idCol = await pickExistingColumn(client, table, idCandidates);
      const bizCol = await pickExistingColumn(client, table, bizCandidates);
      const nameCol = await pickExistingColumn(client, table, nameCandidates);

      if (!idCol || !nameCol || !bizCol) return;

      if (mode === "bizDigits") {
        const r = await client.query(
          `
          SELECT
            ${idCol}::text AS id,
            regexp_replace(COALESCE(${bizCol}::text,''), '[^0-9]', '', 'g') AS business_no,
            ${nameCol} AS business_name,
            $2::text AS store_type
          FROM ${table}
          WHERE regexp_replace(COALESCE(${bizCol}::text,''), '[^0-9]', '', 'g') = $1
          ORDER BY ${idCol} DESC
          LIMIT 30
          `,
          [value, storeType]
        );
        found.push(...r.rows);
        return;
      }

      if (mode === "q") {
        if (qDigits) {
          const r = await client.query(
            `
            SELECT
              ${idCol}::text AS id,
              regexp_replace(COALESCE(${bizCol}::text,''), '[^0-9]', '', 'g') AS business_no,
              ${nameCol} AS business_name,
              $3::text AS store_type
            FROM ${table}
            WHERE ${nameCol} ILIKE '%' || $1 || '%'
               OR regexp_replace(COALESCE(${bizCol}::text,''), '[^0-9]', '', 'g') ILIKE '%' || $2 || '%'
            ORDER BY ${idCol} DESC
            LIMIT 30
            `,
            [value, qDigits, storeType]
          );
          found.push(...r.rows);
        } else {
          const r = await client.query(
            `
            SELECT
              ${idCol}::text AS id,
              regexp_replace(COALESCE(${bizCol}::text,''), '[^0-9]', '', 'g') AS business_no,
              ${nameCol} AS business_name,
              $2::text AS store_type
            FROM ${table}
            WHERE ${nameCol} ILIKE '%' || $1 || '%'
               OR ${bizCol}::text ILIKE '%' || $1 || '%'
            ORDER BY ${idCol} DESC
            LIMIT 30
            `,
            [value, storeType]
          );
          found.push(...r.rows);
        }
      }
    }

    if (bizNoDigits) {
      for (const s of sources) await runSearch(s, "bizDigits", bizNoDigits);
    }

    if (!found.length && q) {
      for (const s of sources) await runSearch(s, "q", q);
    }

    const uniq = new Map();
    for (const s of found) {
      const key = `${s.store_type}|${s.id}|${s.business_no}|${s.business_name}`;
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
 *  ✅ makeMulterStorage() 는 "diskStorage 옵션 객체"를 반환해야 함
 * ------------------------- */
export function makeMulterStorage() {
  ensureUploadDir();
  return {
    destination: (_req, _file, cb) => cb(null, UPLOAD_ABS_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase();
      const safeExt = ext && ext.length <= 10 ? ext : "";
      const name = `${Date.now()}-${crypto.randomUUID()}${safeExt}`;
      cb(null, name);
    },
  };
}

export function fileFilter(_req, file, cb) {
  const allowed = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"];
  if (allowed.includes(file.mimetype)) return cb(null, true);
  return cb(new Error("이미지 파일만 업로드 가능(png/jpg/webp/gif)"), false);
}
