// controllers/indexmanagerAdController.js
import fs from "fs";
import path from "path";
import crypto from "crypto";
import pool from "../db.js";

/**
 * ✅ 설정
 * - 업로드는 /data/uploads/manager_ad 에 저장
 * - 외부 접근은 /uploads/manager_ad/... 로 제공된다고 가정
 *   (server.js 또는 nginx에서 /uploads -> /data/uploads 매핑 필요)
 */
export const UPLOAD_SUBDIR = "manager_ad";
export const UPLOAD_ABS_DIR = path.join("/data/uploads", UPLOAD_SUBDIR);
export const UPLOAD_PUBLIC_PREFIX = `/uploads/${UPLOAD_SUBDIR}`;

/** ✅ DB 테이블명 (필요시 여기만 바꾸면 됨) */
const TABLE = "admin_ad_slots";

/** -------------------------
 *  유틸
 * ------------------------- */
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

/**
 * ✅ datetime-local(YYYY-MM-DDTHH:mm) → 'YYYY-MM-DD HH:mm:00+09:00'
 * - DB가 timestamptz일 때 KST 기준으로 안정 저장하려고 +09:00 붙임
 */
function toKstTimestamptz(dtLocal) {
  const s = cleanStr(dtLocal);
  if (!s) return null;

  // 이미 timezone이 들어있으면 그대로
  if (/[zZ]|[+\-]\d{2}:\d{2}$/.test(s)) return s;

  const normalized = s.replace("T", " ");
  const [d, tRaw] = normalized.split(" ");
  if (!d || !tRaw) return null;

  const t = tRaw.length === 5 ? `${tRaw}:00` : tRaw; // HH:mm -> HH:mm:00
  return `${d} ${t}+09:00`;
}

function pickBody(req) {
  const b = req?.body || {};
  return {
    page: cleanStr(b.page),
    position: cleanStr(b.position),

    // 타입/모드 (camel/snake 혼용 대응)
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

    // 이미지 유지/삭제 제어 (프론트에서 필요하면 사용)
    keepImage: toBool(b.keepImage ?? b.keep_image),
    clearImage: toBool(b.clearImage ?? b.clear_image),
  };
}

async function tableExists(client, tableName) {
  const { rows } = await client.query(
    `SELECT to_regclass($1) as reg`,
    [`public.${tableName}`]
  );
  return !!rows?.[0]?.reg;
}

function mapSlotRow(r) {
  if (!r) return null;
  return {
    page: r.page,
    position: r.position,

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
    start_at_local: r.start_at_local,
    end_at_local: r.end_at_local,

    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

/** -------------------------
 *  API: 슬롯 1개 조회
 *  GET /manager/ad/slot?page=index&position=best_pick_1
 * ------------------------- */
export async function getSlot(req, res) {
  const page = cleanStr(req.query.page);
  const position = cleanStr(req.query.position);

  if (!page || !position) {
    return res
      .status(400)
      .json({ success: false, error: "page, position 필수" });
  }

  const client = await pool.connect();
  try {
    const exists = await tableExists(client, TABLE);
    if (!exists) {
      return res.status(500).json({
        success: false,
        error: `테이블 없음: ${TABLE} (Neon에서 생성 필요)`,
      });
    }

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
      FROM ${TABLE}
      WHERE page=$1 AND position=$2
      LIMIT 1
      `,
      [page, position]
    );

    return res.json({ success: true, slot: mapSlotRow(rows[0] || null) });
  } catch (e) {
    console.error("❌ getSlot error:", e);
    return res.status(500).json({ success: false, error: "서버 오류" });
  } finally {
    client.release();
  }
}

/** -------------------------
 *  API: 페이지 슬롯 전체 조회
 *  GET /manager/ad/slots?page=index
 * ------------------------- */
export async function listSlots(req, res) {
  const page = cleanStr(req.query.page);

  const client = await pool.connect();
  try {
    const exists = await tableExists(client, TABLE);
    if (!exists) {
      return res.status(500).json({
        success: false,
        error: `테이블 없음: ${TABLE} (Neon에서 생성 필요)`,
      });
    }

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
      FROM ${TABLE}
      ${page ? "WHERE page=$1" : ""}
      ORDER BY page, position
      `,
      page ? [page] : []
    );

    return res.json({ success: true, slots: rows.map(mapSlotRow) });
  } catch (e) {
    console.error("❌ listSlots error:", e);
    return res.status(500).json({ success: false, error: "서버 오류" });
  } finally {
    client.release();
  }
}

/** -------------------------
 *  API: 슬롯 저장(업서트)
 *  POST /manager/ad/slot  (multipart/form-data)
 *  - file field: image | slotImage | file 모두 허용 (라우터에서 처리)
 * ------------------------- */
export async function upsertSlot(req, res) {
  ensureUploadDir();

  const body = pickBody(req);
  const {
    page,
    position,
    slotType,
    slotMode,
    linkUrl,
    textContent,
    storeId,
    businessNo,
    businessName,
    startAt,
    endAt,
    noEnd,
    keepImage,
    clearImage,
  } = body;

  if (!page || !position) {
    return res
      .status(400)
      .json({ success: false, error: "page, position 필수" });
  }

  // 업로드 파일 (multer)
  const file = req.file || null;

  const client = await pool.connect();
  try {
    const exists = await tableExists(client, TABLE);
    if (!exists) {
      return res.status(500).json({
        success: false,
        error: `테이블 없음: ${TABLE} (Neon에서 생성 필요)`,
      });
    }

    // 기존 슬롯 조회(이미지 유지용)
    const prev = await client.query(
      `SELECT image_url FROM ${TABLE} WHERE page=$1 AND position=$2 LIMIT 1`,
      [page, position]
    );
    const prevImageUrl = prev.rows?.[0]?.image_url ?? null;

    let nextImageUrl = prevImageUrl;

    if (clearImage) nextImageUrl = null;
    if (file) nextImageUrl = `${UPLOAD_PUBLIC_PREFIX}/${file.filename}`;
    if (!file && !keepImage && prevImageUrl && !clearImage) {
      // keepImage=false로 오면 "이미지 유지"가 아니라 "그대로"로 두는게 보통이라
      // 여기서는 prev 유지(=nextImageUrl 유지)로 처리
      // (프론트에서 진짜 비우려면 clearImage=true로 보내면 됨)
      nextImageUrl = prevImageUrl;
    }

    const startAtTz = noEnd ? toKstTimestamptz(startAt) : toKstTimestamptz(startAt);
    const endAtTz = noEnd ? null : toKstTimestamptz(endAt);

    // 업서트
    const { rows } = await client.query(
      `
      INSERT INTO ${TABLE} (
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
        page,
        position,
        nextImageUrl,
        linkUrl,
        textContent,
        businessNo,
        businessName,
        storeId,
        slotType,
        slotMode,
        startAtTz,
        endAtTz,
        noEnd,
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

/** -------------------------
 *  API: 슬롯 삭제
 *  DELETE /manager/ad/slot?page=index&position=best_pick_1
 * ------------------------- */
export async function deleteSlot(req, res) {
  const page = cleanStr(req.query.page);
  const position = cleanStr(req.query.position);

  if (!page || !position) {
    return res
      .status(400)
      .json({ success: false, error: "page, position 필수" });
  }

  const client = await pool.connect();
  try {
    const exists = await tableExists(client, TABLE);
    if (!exists) {
      return res.status(500).json({
        success: false,
        error: `테이블 없음: ${TABLE} (Neon에서 생성 필요)`,
      });
    }

    await client.query(`DELETE FROM ${TABLE} WHERE page=$1 AND position=$2`, [
      page,
      position,
    ]);

    return res.json({ success: true });
  } catch (e) {
    console.error("❌ deleteSlot error:", e);
    return res.status(500).json({ success: false, error: "서버 오류" });
  } finally {
    client.release();
  }
}

/** -------------------------
 *  API: 가게 검색(사업자번호/키워드)
 *  GET /manager/ad/store/search?bizNo=2910...
 *  GET /manager/ad/store/search?q=미례
 *
 *  ⚠️ 여러 테이블 후보를 "존재하는 것만" 자동으로 조회
 * ------------------------- */
export async function searchStore(req, res) {
  const bizNo = cleanStr(req.query.bizNo ?? req.query.businessNo);
  const q = cleanStr(req.query.q ?? req.query.keyword);

  const client = await pool.connect();
  try {
    // 후보 테이블들(프로젝트에서 실제 존재하는 것만 골라서 사용됨)
    const candidates = [
      { table: "combined_store_info", id: "id", biz: "business_no", name: "business_name" },
      { table: "store_info", id: "id", biz: "business_no", name: "business_name" },
      { table: "food_stores", id: "id", biz: "business_no", name: "store_name" },
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

    // 중복 제거 (id+bizNo 기준)
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

/** -------------------------
 *  (옵션) Neon에서 테이블 만들 때 쓰는 SQL
 *  - 요청하면 이걸 그대로 SQL Editor에 실행하면 됨
 * ------------------------- */
export function getCreateTableSQL() {
  return `
-- ✅ 관리자 광고 슬롯 테이블 (기본형)
CREATE TABLE IF NOT EXISTS ${TABLE} (
  page         TEXT NOT NULL,
  position     TEXT NOT NULL,
  image_url    TEXT,
  link_url     TEXT,
  text_content TEXT,
  business_no  TEXT,
  business_name TEXT,
  store_id     TEXT,
  slot_type    TEXT,
  slot_mode    TEXT,
  start_at     TIMESTAMPTZ,
  end_at       TIMESTAMPTZ,
  no_end       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (page, position)
);
`;
}

/** -------------------------
 *  multer storage helper (라우터에서 사용)
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
  const allowed = [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/gif",
  ];
  if (allowed.includes(file.mimetype)) return cb(null, true);
  return cb(new Error("이미지 파일만 업로드 가능(png/jpg/webp/gif)"), false);
}
