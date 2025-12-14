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
  // tableName 예: "public.admin_ad_slots"
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
  return (
    f.image?.[0] ||
    f.slotImage?.[0] ||
    f.file?.[0] ||
    null
  );
}

/* -------------------------
 * ✅ "가게 선택했는데 이미지가 null" 문제 해결
 * slot_mode=store & image_url 비어있으면
 * DB에서 가게 대표이미지(main_image_url 등)를 찾아서 image_url로 보강
 * ------------------------- */
function onlyDigits(v) {
  const s = cleanStr(v);
  return s ? s.replace(/[^0-9]/g, "") : null;
}

function normalizeImageUrl(v) {
  const s = cleanStr(v);
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  return s.startsWith("/") ? s : `/${s}`;
}

function splitTableRefGlobal(full) {
  const [schema, name] = String(full).includes(".")
    ? String(full).split(".")
    : ["public", String(full)];
  return { schema, name };
}

async function pickExistingColumnGlobal(client, fullTable, candidates) {
  const { schema, name } = splitTableRefGlobal(fullTable);
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

async function fetchStoreMainImage(client, { storeId, businessNo, businessName }) {
  // 여러 소스 중 "있는 테이블/있는 컬럼"을 자동으로 골라서 대표이미지 찾아냄
  const sources = [
    {
      table: "public.combined_store_info",
      idCandidates: ["id", "store_id"],
      bizCandidates: ["business_number", "business_no", "biz_no", "bizno", "b_no", "bno", "business_num"],
      nameCandidates: ["business_name", "store_name", "name", "title"],
      imgCandidates: ["main_image_url", "image_url", "main_img", "main_image", "image1", "main_img_url"],
    },
    {
      table: "public.store_info",
      idCandidates: ["id", "store_id"],
      bizCandidates: ["business_no", "business_number", "biz_no", "bizno", "b_no", "bno", "business_num"],
      nameCandidates: ["business_name", "store_name", "name", "title"],
      imgCandidates: ["main_image_url", "image_url", "image1", "main_img", "main_image", "main_img_url"],
    },
    {
      table: "public.food_stores",
      idCandidates: ["id", "store_id"],
      bizCandidates: ["business_no", "business_number", "biz_no", "bizno", "b_no", "bno", "business_num"],
      nameCandidates: ["store_name", "business_name", "name", "title"],
      imgCandidates: ["main_image_url", "image_url", "main_img", "main_image", "main_img_url"],
    },
  ];

  for (const s of sources) {
    const ok = await tableExists(client, s.table);
    if (!ok) continue;

    const idCol = await pickExistingColumnGlobal(client, s.table, s.idCandidates);
    const bizCol = await pickExistingColumnGlobal(client, s.table, s.bizCandidates);
    const nameCol = await pickExistingColumnGlobal(client, s.table, s.nameCandidates);
    const imgCol = await pickExistingColumnGlobal(client, s.table, s.imgCandidates);

    if (!imgCol) continue;

    // 1) storeId 우선
    if (storeId && idCol) {
      const { rows } = await client.query(
        `SELECT ${imgCol} AS image_url FROM ${s.table} WHERE ${idCol}::text = $1 LIMIT 1`,
        [String(storeId)]
      );
      const img = normalizeImageUrl(rows?.[0]?.image_url);
      if (img) return img;
    }

    // 2) businessNo(숫자만 비교)
    const bizDigits = onlyDigits(businessNo);
    if (bizDigits && bizCol) {
      const { rows } = await client.query(
        `
        SELECT ${imgCol} AS image_url
        FROM ${s.table}
        WHERE regexp_replace(COALESCE(${bizCol}::text,''), '[^0-9]', '', 'g') = $1
        ${idCol ? `ORDER BY ${idCol} DESC` : ""}
        LIMIT 1
        `,
        [bizDigits]
      );
      const img = normalizeImageUrl(rows?.[0]?.image_url);
      if (img) return img;
    }

    // 3) businessName
    if (businessName && nameCol) {
      const { rows } = await client.query(
        `
        SELECT ${imgCol} AS image_url
        FROM ${s.table}
        WHERE ${nameCol} ILIKE '%' || $1 || '%'
        ${idCol ? `ORDER BY ${idCol} DESC` : ""}
        LIMIT 1
        `,
        [businessName]
      );
      const img = normalizeImageUrl(rows?.[0]?.image_url);
      if (img) return img;
    }
  }

  return null;
}

async function attachStoreImageIfMissing(client, slot, cache) {
  if (!slot) return slot;

  // slot_mode=store인데 image_url이 없으면 가게 대표이미지로 보강
  if (slot.slot_mode === "store" && !cleanStr(slot.image_url)) {
    const key = `${slot.store_id || ""}|${onlyDigits(slot.business_no) || ""}|${slot.business_name || ""}`;
    if (cache && cache.has(key)) {
      const cached = cache.get(key);
      if (cached) slot.image_url = cached;
      return slot;
    }

    const img = await fetchStoreMainImage(client, {
      storeId: slot.store_id,
      businessNo: slot.business_no,
      businessName: slot.business_name,
    });

    if (cache) cache.set(key, img || null);
    if (img) slot.image_url = img;
  }

  return slot;
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
 *  ✅ 기본: "현재 노출 1개"를 반환(우선순위/기간 반영)
 *  ✅ ?priority=2 로 주면 해당 후보 1개를 반환(편집용)
 * ------------------------- */
export async function getSlot(req, res) {
  const page = cleanStr(req.query.page);
  const position = cleanStr(req.query.position);
  const priority = toInt(req.query.priority);

  if (!page || !position) {
    return res.status(400).json({ success: false, error: "page, position 필수" });
  }

  const client = await pool.connect();
  const cache = new Map();
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

      const slot = mapSlotRow(rows[0] || null);
      await attachStoreImageIfMissing(client, slot, cache);
      return res.json({ success: true, slot });
    }

    // ✅ 기본: 노출 1개(우선순위 후보가 있으면 후보 우선)
    if (itemsOk) {
      const row = await getEffectiveSlotFromItems(client, page, position);
      if (row) {
        const slot = mapSlotRow(row);
        await attachStoreImageIfMissing(client, slot, cache);
        return res.json({ success: true, slot });
      }
    }

    if (legacyOk) {
      const row = await getLegacySlot(client, page, position);
      const slot = mapSlotRow(row);
      await attachStoreImageIfMissing(client, slot, cache);
      return res.json({ success: true, slot });
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
 *  ✅ 각 position당 "노출 1개" 리스트(우선순위/기간 반영)
 *  ✅ 후보가 없으면 legacy로 폴백
 * ------------------------- */
export async function listSlots(req, res) {
  const page = cleanStr(req.query.page);

  const client = await pool.connect();
  const cache = new Map();
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
        const slot = mapSlotRow(r);
        await attachStoreImageIfMissing(client, slot, cache);
        map.set(`${r.page}|${r.position}`, slot);
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
        if (!map.has(key)) {
          const slot = mapSlotRow(r);
          await attachStoreImageIfMissing(client, slot, cache);
          map.set(key, slot);
        }
      }
    }

    return res.json({ success: true, slots: Array.from(map.values()) });
  } catch (e) {
    console.error("❌ listSlots error:", e);
    return res.status(500).json({ success: false, error: "서버 오류" });
  } finally {
    client.release();
  }
}

/* -------------------------
 *  GET /manager/ad/slot-items?page=index&position=best_pick_1
 *  ✅ 후보 전체(우선순위 관리용)
 * ------------------------- */
export async function listSlotItems(req, res) {
  const page = cleanStr(req.query.page);
  const position = cleanStr(req.query.position);

  if (!page || !position) {
    return res.status(400).json({ success: false, error: "page, position 필수" });
  }

  const client = await pool.connect();
  const cache = new Map();
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

    const items = [];
    for (const r of rows) {
      const slot = mapSlotRow(r);
      await attachStoreImageIfMissing(client, slot, cache);
      items.push(slot);
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
 *  ✅ priority가 오면 "후보 테이블"에 저장
 *  ✅ priority가 없으면 "legacy 테이블"에 저장(기존 방식)
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
  const cache = new Map();
  try {
    const itemsOk = await tableExists(client, ITEMS_TABLE);
    const legacyOk = await tableExists(client, LEGACY_TABLE);

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

      let nextImageUrl = prevImageUrl;
      if (clearImage) nextImageUrl = null;
      if (file) nextImageUrl = `${UPLOAD_PUBLIC_PREFIX}/${file.filename}`;
      if (!file && keepImage) nextImageUrl = prevImageUrl;

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

      const slot = mapSlotRow(rows[0]);
      await attachStoreImageIfMissing(client, slot, cache);
      return res.json({ success: true, slot });
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
    if (file) nextImageUrl = `${UPLOAD_PUBLIC_PREFIX}/${file.filename}`;
    if (!file && keepImage) nextImageUrl = prevImageUrl;

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

    const slot = mapSlotRow(rows[0]);
    await attachStoreImageIfMissing(client, slot, cache);
    return res.json({ success: true, slot });
  } catch (e) {
    console.error("❌ upsertSlot error:", e);
    return res.status(500).json({ success: false, error: "서버 오류" });
  } finally {
    client.release();
  }
}

/* -------------------------
 *  DELETE /manager/ad/slot?page=index&position=...&priority=2
 *  ✅ priority 있으면 후보 삭제
 *  ✅ 없으면 legacy 삭제
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

      // id/name/biz 중 하나라도 없으면 이 소스는 스킵
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

    // ✅ bizNo로 못 찾으면(또는 bizNo가 없으면) q로 검색(프론트가 name/businessName 보냈을 때 여기로 잡힘)
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
