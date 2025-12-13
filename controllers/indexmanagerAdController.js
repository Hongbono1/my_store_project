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
      return res.json({ success: true, slot: mapSlotRow(rows[0] || null) });
    }

    // ✅ 기본: 노출 1개(우선순위 후보가 있으면 후보 우선)
    if (itemsOk) {
      const row = await getEffectiveSlotFromItems(client, page, position);
      if (row) return res.json({ success: true, slot: mapSlotRow(row) });
    }

    if (legacyOk) {
      const row = await getLegacySlot(client, page, position);
      return res.json({ success: true, slot: mapSlotRow(row) });
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

    return res.json({ success: true, items: rows.map(mapSlotRow) });
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

      return res.json({ success: true, slot: mapSlotRow(rows[0]) });
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

    return res.json({ success: true, slot: mapSlotRow(rows[0]) });
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
  const bizNo = cleanStr(req.query.bizNo ?? req.query.businessNo);
  const q = cleanStr(req.query.q ?? req.query.keyword);

  const client = await pool.connect();
  try {
    const candidates = [
      { table: "public.combined_store_info", id: "id", biz: "business_no", name: "business_name" },
      { table: "public.store_info", id: "id", biz: "business_no", name: "business_name" },
      { table: "public.food_stores", id: "id", biz: "business_no", name: "store_name" },
    ];

    const found = [];
    for (const c of candidates) {
      const ok = await tableExists(client, c.table);
      if (!ok) continue;

      if (bizNo) {
        const r = await client.query(
          `
          SELECT
            ${c.id}::text AS id,
            ${c.biz}      AS business_no,
            ${c.name}     AS business_name
          FROM ${c.table}
          WHERE ${c.biz} = $1
          ORDER BY ${c.id} DESC
          LIMIT 30
          `,
          [bizNo]
        );
        found.push(...r.rows);
      } else if (q) {
        const r = await client.query(
          `
          SELECT
            ${c.id}::text AS id,
            ${c.biz}      AS business_no,
            ${c.name}     AS business_name
          FROM ${c.table}
          WHERE ${c.name} ILIKE '%' || $1 || '%'
             OR ${c.biz}  ILIKE '%' || $1 || '%'
          ORDER BY ${c.id} DESC
          LIMIT 30
          `,
          [q]
        );
        found.push(...r.rows);
      }
    }

    const uniq = new Map();
    for (const s of found) {
      const key = `${s.id}|${s.business_no}`;
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
