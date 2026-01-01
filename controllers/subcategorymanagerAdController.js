// controllers/subcategoryFoodAdController.js
import fs from "fs";
import path from "path";
import crypto from "crypto";
import pool from "../db.js";

// 업로드 경로(고정)
export const UPLOAD_SUBDIR = "manager_ad";
export const UPLOAD_ABS_DIR = path.join("/data/uploads", UPLOAD_SUBDIR);
export const UPLOAD_PUBLIC_PREFIX = `/uploads/${UPLOAD_SUBDIR}`;

// 슬롯 테이블
const SLOTS_TABLE = "public.admin_ad_slots";

// FOOD 테이블 / 이미지 테이블(확정)
const FOOD_TABLE = "public.store_info";
const FOOD_IMAGES_TABLE = "public.store_images";

function ensureUploadDir() {
  fs.mkdirSync(UPLOAD_ABS_DIR, { recursive: true });
}

// multer helpers
export function makeMulterStorage() {
  ensureUploadDir();
  return {
    destination: (_req, _file, cb) => cb(null, UPLOAD_ABS_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase();
      const safeExt = ext && ext.length <= 10 ? ext : "";
      const name = `${Date.now()}_${crypto.randomBytes(6).toString("hex")}${safeExt}`;
      cb(null, name);
    },
  };
}
export function fileFilter(_req, file, cb) {
  const ok = /^image\/(png|jpeg|jpg|webp|gif)$/.test(file.mimetype || "");
  if (!ok) return cb(new Error("Only image files are allowed"));
  cb(null, true);
}

// utils
const s = (v) => String(v ?? "").trim();
const digitsOnly = (v) => String(v ?? "").replace(/[^\d]/g, "");
const toInt = (v, def) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

// ✅ 프론트 buildPosition 과 동일(푸드 전용 suffix)
function buildPosition(area, pageNo, boxNo) {
  const suffix = "__food";
  if (area === "top") return `subcategory_top${suffix}`;

  const prefix =
    area === "best_seller" ? "best_seller" :
    area === "new_registration" ? "new_registration" :
    "all_items";

  return `${prefix}__p${pageNo}__b${boxNo}${suffix}`;
}

// ✅ position을 줬으면 그걸 우선, 없으면 section/idx를 position으로 변환(배너용)
function resolvePositionFromReq(req) {
  const position = s(req.query.position || req.body.position);
  if (position) return position;

  // 레거시/배너: section=top, idx=1 형태 지원
  const section = s(req.query.section || req.body.section);
  const idx = s(req.query.idx || req.body.idx);
  const pageNo = toInt(req.query.pageNo || req.body.pageNo, 1);

  if (!section) return "";
  if (section === "top") return buildPosition("top", 1, 1);

  const boxNo = toInt(idx, 1);
  return buildPosition(section, pageNo, boxNo);
}

function parsePosition(position) {
  // all_items__p1__b3__food
  const p = String(position || "");
  const out = {
    section_label: "",
    page_number: null,
    index_in_page: null,
  };

  if (p.startsWith("subcategory_top__")) {
    out.section_label = "top";
    out.page_number = 1;
    out.index_in_page = 1;
    return out;
  }

  const m = p.match(/^(all_items|best_seller|new_registration)__p(\d+)__b(\d+)__/);
  if (m) {
    out.section_label = m[1];
    out.page_number = Number(m[2]);
    out.index_in_page = Number(m[3]);
  }
  return out;
}

function normalizeLocalDateTime(v) {
  // datetime-local: "2026-01-01T21:05"
  const t = s(v);
  if (!t) return null;
  // DB가 timestamp/timestamptz 어느쪽이든 무난하게 들어가도록 ISO로 변환
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

// ------------------------------------------------------------------
// 1) GRID: 12개 가게 + 각 박스에 슬롯이 저장되어 있으면 occupied 표시
// ------------------------------------------------------------------
export async function grid(req, res) {
  try {
    const page = s(req.query.page) || "subcategory";
    const section = s(req.query.section) || "all_items";
    const pageNo = Math.max(toInt(req.query.pageNo, 1), 1);

    // (선택) 필터
    const category = s(req.query.category);
    const subcategory = s(req.query.subcategory);

    const pageSize = 12;
    const offset = (pageNo - 1) * pageSize;

    const where = [];
    const vals = [];
    let k = 1;

    if (category) {
      where.push(`s.business_category = $${k++}`);
      vals.push(category);
    }
    if (subcategory) {
      // store_info에 detail_category가 “하위”로 쓰이는 케이스가 많아서 우선 여기로 매핑
      where.push(`COALESCE(NULLIF(s.detail_category,''), '') = $${k++}`);
      vals.push(subcategory);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    // ✅ store_images에서 첫 장만(url)
    const storeSql = `
      SELECT
        s.id,
        s.business_number,
        s.business_name,
        s.business_type,
        s.business_category,
        COALESCE(NULLIF(s.detail_category,''), NULL) AS business_subcategory,
        COALESCE(img.url, '') AS image_url
      FROM ${FOOD_TABLE} s
      LEFT JOIN LATERAL (
        SELECT si.url
        FROM ${FOOD_IMAGES_TABLE} si
        WHERE si.store_id = s.id
        ORDER BY si.id ASC
        LIMIT 1
      ) img ON true
      ${whereSql}
      ORDER BY s.id DESC
      LIMIT ${pageSize} OFFSET ${offset};
    `;

    const stores = (await pool.query(storeSql, vals)).rows || [];

    // 이번 페이지의 12칸 position들
    const positions = [];
    for (let box = 1; box <= 12; box++) {
      positions.push(buildPosition(section, pageNo, box));
    }

    // 슬롯 한방 조회
    const slotSql = `
      SELECT *
      FROM ${SLOTS_TABLE}
      WHERE page = $1
        AND position = ANY($2)
        AND priority = 1
      ;
    `;
    const slotRows = (await pool.query(slotSql, [page, positions])).rows || [];
    const slotMap = new Map(slotRows.map((r) => [r.position, r]));

    // 12칸 반환(스토어 없으면 빈칸)
    const items = [];
    for (let box = 1; box <= 12; box++) {
      const store = stores[box - 1] || null;
      const pos = buildPosition(section, pageNo, box);
      const slot = slotMap.get(pos);

      const label =
        slot?.slot_type === "text"
          ? (slot.text_title || "(텍스트)")
          : slot?.slot_mode === "store"
            ? (slot.store_name || store?.business_name || "(가게연결)")
            : (store?.business_name || (slot?.image_url ? "(이미지)" : "(비었음)"));

      items.push({
        boxNo: box,
        position: pos,
        priority: slot?.priority ?? 1,
        occupied: !!slot,

        // grid 클릭 시 우측 파란박스에 채우기 위한 값들
        id: store?.id ?? null,
        business_number: store?.business_number ?? "",
        business_name: store?.business_name ?? "",
        business_type: store?.business_type ?? "",
        business_category: store?.business_category ?? "",
        business_subcategory: store?.business_subcategory ?? "",
        image_url: store?.image_url ?? "",

        label,
      });
    }

    return res.json({
      success: true,
      mode: "food",
      page,
      section,
      category: category || "",
      subcategory: subcategory || "",
      pageNo,
      pageSize: 12,
      items,
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || "grid failed" });
  }
}

// ------------------------------------------------------------------
// 2) SEARCH: 사업자번호/상호 검색 + 페이지/박스 위치(rn 기반) 계산
// ------------------------------------------------------------------
export async function searchStore(req, res) {
  try {
    const mode = "food";
    const qRaw = s(req.query.q);
    const q = qRaw === "__all__" ? "" : qRaw;
    const pageSize = Math.min(Math.max(toInt(req.query.pageSize, 12), 1), 50);

    const qDigits = digitsOnly(q);
    const isBiz = !!qDigits && qDigits.length >= 4;

    const where = [];
    const vals = [];
    let k = 1;

    if (q) {
      if (isBiz) {
        where.push(`REPLACE(REPLACE(COALESCE(s.business_number,''),'-',''),' ','') LIKE $${k++}`);
        vals.push(`%${qDigits}%`);
      } else {
        where.push(`COALESCE(s.business_name,'') ILIKE $${k++}`);
        vals.push(`%${q}%`);
      }
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const sql = `
      WITH base AS (
        SELECT
          s.id,
          s.business_number,
          s.business_name,
          s.business_type,
          s.business_category,
          COALESCE(NULLIF(s.detail_category,''), NULL) AS business_subcategory,
          COALESCE(img.url, '') AS image_url,
          ROW_NUMBER() OVER (ORDER BY s.id DESC) AS rn
        FROM ${FOOD_TABLE} s
        LEFT JOIN LATERAL (
          SELECT si.url
          FROM ${FOOD_IMAGES_TABLE} si
          WHERE si.store_id = s.id
          ORDER BY si.id ASC
          LIMIT 1
        ) img ON true
        ${whereSql}
      )
      SELECT
        *,
        CEIL(rn / 12.0)::int AS page_number,
        ((rn - 1) % 12 + 1)::int AS index_in_page
      FROM base
      ORDER BY rn
      LIMIT ${pageSize};
    `;

    const rows = (await pool.query(sql, vals)).rows || [];

    return res.json({
      success: true,
      mode,
      q: qRaw || "",
      results: rows,
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || "search failed" });
  }
}

// ------------------------------------------------------------------
// 3) SLOT: page+position+priority 로 조회 (section 강제 금지!)
// ------------------------------------------------------------------
export async function getSlot(req, res) {
  try {
    const page = s(req.query.page) || "subcategory";
    const priority = Math.max(toInt(req.query.priority, 1), 1);

    const position = resolvePositionFromReq(req);
    if (!position) {
      return res.status(400).json({ success: false, error: "position is required" });
    }

    const sql = `
      SELECT *
      FROM ${SLOTS_TABLE}
      WHERE page = $1 AND position = $2 AND priority = $3
      LIMIT 1;
    `;
    const r = await pool.query(sql, [page, position, priority]);
    const slot = r.rows?.[0] || null;

    return res.json({
      success: true,
      page,
      position,
      priority,
      slot,
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || "slot failed" });
  }
}

// ------------------------------------------------------------------
// 4) UPDATE: multipart/form-data 저장 (image 필드) + storeImageUrl도 허용
// ------------------------------------------------------------------
export async function upsertSlot(req, res) {
  try {
    const page = s(req.body.page) || "subcategory";
    const priority = Math.max(toInt(req.body.priority, 1), 1);

    const position = resolvePositionFromReq(req);
    if (!position) {
      return res.status(400).json({ success: false, error: "position is required" });
    }

    const adMode = s(req.body.adMode);     // "banner" | "text" 등
    const slotMode = s(req.body.slotMode); // "store" | "custom"

    const slot_type = adMode === "text" ? "text" : "banner";
    const slot_mode = slotMode === "store" ? "store" : "custom";

    const link_url = s(req.body.linkUrl);
    const text_title = s(req.body.textTitle);
    const text_desc = s(req.body.textDesc);

    const store_id = s(req.body.storeId) || null;
    const store_business_number = s(req.body.storeBusinessNumber) || null;
    const store_name = s(req.body.storeName) || null;
    const store_type = s(req.body.storeType) || null;

    const store_image_url = s(req.body.storeImageUrl) || null;

    // ✅ 업로드 파일 우선
    let image_url = null;
    if (req.file?.filename) {
      image_url = `${UPLOAD_PUBLIC_PREFIX}/${req.file.filename}`;
    } else if (store_image_url) {
      // ✅ 파일 없으면 storeImageUrl로 대체
      image_url = store_image_url;
    }

    const no_end = String(req.body.noEnd || "").toLowerCase() === "true";
    const start_at = normalizeLocalDateTime(req.body.startAt);
    const end_at = normalizeLocalDateTime(req.body.endAt);

    // ✅ DB 컬럼들이 기존에 있다고 가정(현재 프로젝트에서 이미 사용 중)
    const sql = `
      INSERT INTO ${SLOTS_TABLE}
      (page, position, priority,
       slot_type, slot_mode,
       image_url, link_url,
       text_title, text_desc,
       store_id, store_business_number, store_name, store_type, store_image_url,
       start_at, end_at, no_end,
       updated_at)
      VALUES
      ($1,$2,$3,
       $4,$5,
       COALESCE($6,''), $7,
       $8,$9,
       $10,$11,$12,$13,$14,
       $15,$16,$17,
       NOW())
      ON CONFLICT (page, position, priority)
      DO UPDATE SET
        slot_type = EXCLUDED.slot_type,
        slot_mode = EXCLUDED.slot_mode,
        image_url = CASE
          WHEN $6 IS NULL OR $6 = '' THEN ${SLOTS_TABLE.split(".").pop()}.image_url
          ELSE EXCLUDED.image_url
        END,
        link_url = EXCLUDED.link_url,
        text_title = EXCLUDED.text_title,
        text_desc = EXCLUDED.text_desc,
        store_id = EXCLUDED.store_id,
        store_business_number = EXCLUDED.store_business_number,
        store_name = EXCLUDED.store_name,
        store_type = EXCLUDED.store_type,
        store_image_url = EXCLUDED.store_image_url,
        start_at = EXCLUDED.start_at,
        end_at = EXCLUDED.end_at,
        no_end = EXCLUDED.no_end,
        updated_at = NOW()
      RETURNING *;
    `;

    const params = [
      page, position, priority,
      slot_type, slot_mode,
      image_url || "",
      link_url,
      text_title,
      text_desc,
      store_id,
      store_business_number,
      store_name,
      store_type,
      store_image_url,
      start_at,
      end_at,
      no_end,
    ];

    const r = await pool.query(sql, params);
    const slot = r.rows?.[0] || null;

    return res.json({
      success: true,
      page,
      position,
      priority,
      slot,
      image_url: slot?.image_url || "",
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || "update failed" });
  }
}

// ------------------------------------------------------------------
// 5) DELETE: page+position+priority 로 삭제
// ------------------------------------------------------------------
export async function deleteSlot(req, res) {
  try {
    const page = s(req.query.page) || "subcategory";
    const priority = Math.max(toInt(req.query.priority, 1), 1);

    const position = resolvePositionFromReq(req);
    if (!position) {
      return res.status(400).json({ success: false, error: "position is required" });
    }

    const sql = `
      DELETE FROM ${SLOTS_TABLE}
      WHERE page = $1 AND position = $2 AND priority = $3;
    `;
    const r = await pool.query(sql, [page, position, priority]);

    return res.json({
      success: true,
      page,
      position,
      priority,
      deleted: r.rowCount || 0,
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || "delete failed" });
  }
}

// ------------------------------------------------------------------
// 6) WHERE: 사업자번호로 이 가게가 어디에 등록됐는지 조회
// ------------------------------------------------------------------
export async function whereSlots(req, res) {
  try {
    const page = s(req.query.page) || "subcategory";
    const q = digitsOnly(req.query.q);
    const limit = Math.min(Math.max(toInt(req.query.limit, 100), 1), 300);

    if (!q) return res.status(400).json({ success: false, error: "q is required" });

    const sql = `
      SELECT page, position, priority, slot_type, slot_mode, start_at, end_at, no_end, updated_at
      FROM ${SLOTS_TABLE}
      WHERE page = $1
        AND COALESCE(store_business_number,'') LIKE $2
      ORDER BY updated_at DESC NULLS LAST
      LIMIT ${limit};
    `;
    const rows = (await pool.query(sql, [page, `%${q}%`])).rows || [];

    const items = rows.map((r) => ({
      ...r,
      parsed: parsePosition(r.position),
    }));

    return res.json({ success: true, items });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message || "where failed" });
  }
}
