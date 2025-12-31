// controllers/subcategorymanagerFoodAdController.js
import fs from "fs";
import path from "path";
import crypto from "crypto";
import pool from "../db.js";

/**
 * ----------------------------------------------------------
 *  Subcategory Manager (FOOD) - Controller (Full)
 *  - Upload dir: /data/uploads/manager_ad
 *  - Slot table: public.admin_ad_slots (reuse)
 *  - Food store table: auto-detect from candidates (default store_info)
 *  - Prevent SQL placeholder mismatch ($1 error) by always passing params
 *  - Prevent "const in SQL" by keeping SQL strings clean
 *  - Reduce column mismatch by introspecting existing columns
 * ----------------------------------------------------------
 */

// 업로드 경로(다른 매니저와 동일)
export const UPLOAD_SUBDIR = "manager_ad";
export const UPLOAD_ABS_DIR = path.join("/data/uploads", UPLOAD_SUBDIR);
export const UPLOAD_PUBLIC_PREFIX = `/uploads/${UPLOAD_SUBDIR}`;

// 슬롯 테이블(기존 재사용)
const SLOTS_TABLE = "public.admin_ad_slots";

// food 후보 테이블(존재하는 것 중 첫 번째 사용)
const FOOD_TABLE_CANDIDATES = [
    "public.store_info",
    "public.food_stores",
    "public.food_store_info",
    "public.food_store",
];

// 페이지 고정(서브카테고리)
const PAGE_NAME = "subcategory";

/** ----------------- util ----------------- */
function ensureUploadDir() {
    fs.mkdirSync(UPLOAD_ABS_DIR, { recursive: true });
}

function clean(v) {
    if (v === undefined || v === null) return "";
    return String(v).trim();
}

function digitsOnly(v) {
    return clean(v).replace(/[^\d]/g, "");
}

function safeInt(v, fallback = 0) {
    const n = parseInt(String(v ?? ""), 10);
    return Number.isFinite(n) ? n : fallback;
}

function clamp(n, min, max) {
    return Math.min(Math.max(n, min), max);
}

function toBool(v) {
    const s = clean(v).toLowerCase();
    return s === "1" || s === "true" || s === "y" || s === "yes" || s === "on";
}

function safeDateOrNull(v) {
    const s = clean(v);
    if (!s) return null;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// position 키에 쓸 값 정리(구분자 충돌 방지)
function keyPart(v) {
    return clean(v).replaceAll("|", "/");
}

/**
 * position 규칙(FOOD)
 * subcategory|food|{category}|{subcategory}|{section}|{idx}
 */
function buildPosition({ mode = "food", category = "", subcategory = "", section = "", idx = 1 }) {
    return [
        PAGE_NAME,
        keyPart(mode || "food"),
        keyPart(category),
        keyPart(subcategory),
        keyPart(section),
        String(idx),
    ].join("|");
}

function parseIdxFromPosition(position) {
    const parts = String(position || "").split("|");
    const last = parts[parts.length - 1];
    const n = parseInt(last, 10);
    return Number.isFinite(n) ? n : null;
}

/** ----------------- multer helpers ----------------- */
export function fileFilter(_req, file, cb) {
    // 기본: 이미지 + 텍스트 파일은 막을 이유 없지만, 업로드는 이미지 중심
    const ok = !!file?.mimetype?.startsWith("image/");
    if (!ok) return cb(new Error("Only image files are allowed"), false);
    return cb(null, true);
}

export function makeMulterStorage() {
    ensureUploadDir();

    return {
        destination: (_req, _file, cb) => {
            ensureUploadDir();
            cb(null, UPLOAD_ABS_DIR);
        },
        filename: (_req, file, cb) => {
            const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
            const name = `${crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString("hex")}${ext}`;
            cb(null, name);
        },
    };
}

/** ----------------- schema introspection (slots) ----------------- */
let _slotsColsCache = null;
async function getSlotsColumns() {
    if (_slotsColsCache) return _slotsColsCache;

    const sql = `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = $1 AND table_name = $2
  `;
    const [schema, table] = SLOTS_TABLE.split(".");
    const { rows } = await pool.query(sql, [schema.replaceAll('"', ""), table.replaceAll('"', "")]);
    const cols = new Set(rows.map((r) => r.column_name));
    _slotsColsCache = cols;
    return cols;
}

function hasCol(cols, name) {
    return cols && cols.has(name);
}

/** ----------------- schema introspection (food table) ----------------- */
let _foodTableCache = null;
let _foodColsCache = null;

async function pickFoodTable() {
    if (_foodTableCache) return _foodTableCache;

    // to_regclass로 존재 여부 확인
    for (const t of FOOD_TABLE_CANDIDATES) {
        const q = "SELECT to_regclass($1) AS reg";
        const { rows } = await pool.query(q, [t]);
        if (rows?.[0]?.reg) {
            _foodTableCache = t;
            return _foodTableCache;
        }
    }
    // 없으면 fallback
    _foodTableCache = FOOD_TABLE_CANDIDATES[0];
    return _foodTableCache;
}

async function getFoodColumns() {
    if (_foodColsCache) return _foodColsCache;

    const t = await pickFoodTable();
    const [schema, table] = t.split(".");
    const sql = `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = $1 AND table_name = $2
  `;
    const { rows } = await pool.query(sql, [schema.replaceAll('"', ""), table.replaceAll('"', "")]);
    const cols = new Set(rows.map((r) => r.column_name));
    _foodColsCache = cols;
    return cols;
}

/**
 * food 테이블 컬럼 매핑
 * - store_info 기준: business_number, business_name, business_type, business_category, detail_category
 * - 다른 테이블이면 비슷한 컬럼명 후보를 찾아 사용
 */
async function getFoodMapping() {
    const cols = await getFoodColumns();

    const pick = (cands, fallback = "") => {
        for (const c of cands) if (cols.has(c)) return c;
        return fallback;
    };

    const map = {
        id: pick(["id", "store_id"], "id"),
        businessNo: pick(["business_no", "business_number", "biz_no", "biz_number"], "business_number"),
        businessName: pick(["business_name", "store_name", "name"], "business_name"),
        businessType: pick(["business_type", "store_type", "type"], "business_type"),
        category: pick(["business_category", "category"], "business_category"),
        subcategory: pick(["business_subcategory", "detail_category", "subcategory"], "detail_category"),
        imageUrl: pick(
            ["image_url", "main_image_url", "thumbnail_url", "thumb_url", "store_image_url"],
            "" // 없으면 빈값
        ),
    };

    return { cols, map, table: await pickFoodTable() };
}

/** ----------------- SLOT helpers ----------------- */
function safePublicImageUrl(file) {
    if (!file?.filename) return "";
    return `${UPLOAD_PUBLIC_PREFIX}/${file.filename}`;
}

function safeUnlinkIfMine(imageUrl) {
    try {
        const url = String(imageUrl || "");
        if (!url.startsWith(UPLOAD_PUBLIC_PREFIX + "/")) return;
        const filename = url.replace(UPLOAD_PUBLIC_PREFIX + "/", "");
        if (!filename) return;
        const abs = path.join(UPLOAD_ABS_DIR, filename);
        if (abs.startsWith(UPLOAD_ABS_DIR) && fs.existsSync(abs)) {
            fs.unlinkSync(abs);
        }
    } catch (_e) {
        // ignore
    }
}

/** ----------------- API: stores (modal search/list) ----------------- */
export async function listStores(req, res) {
    try {
        const q = clean(req.query.q);
        const pageNo = Math.max(safeInt(req.query.pageNo, 1), 1);
        const pageSize = clamp(safeInt(req.query.pageSize, 20), 1, 100);
        const offset = (pageNo - 1) * pageSize;

        const { map, table } = await getFoodMapping();

        // 검색 조건: q가 숫자면 사업자번호, 아니면 상호명/업종도 포함
        const qDigits = digitsOnly(q);
        const params = [];
        let i = 1;
        const where = [];

        if (q) {
            // 사업자번호 match
            if (qDigits) {
                where.push(`${map.businessNo} ILIKE $${i++}`);
                params.push(`%${qDigits}%`);
            }

            // 이름 match
            where.push(`${map.businessName} ILIKE $${i++}`);
            params.push(`%${q}%`);

            // 업종 match(있으면)
            if (map.businessType && map.businessType !== map.businessName) {
                where.push(`${map.businessType} ILIKE $${i++}`);
                params.push(`%${q}%`);
            }
        }

        // limit/offset
        const limitIdx = i++;
        const offsetIdx = i++;
        params.push(pageSize, offset);

        const sql = `
      SELECT
        ${map.id} AS id,
        ${map.businessNo} AS business_number,
        ${map.businessName} AS business_name,
        ${map.businessType} AS business_type,
        ${map.category} AS business_category,
        ${map.subcategory} AS business_subcategory
        ${map.imageUrl ? `, COALESCE(${map.imageUrl}, '') AS image_url` : `, '' AS image_url`}
      FROM ${table}
      ${where.length ? `WHERE (${where.join(" OR ")})` : ""}
      ORDER BY ${map.id} DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `;

        const { rows } = await pool.query(sql, params);

        return res.json({
            success: true,
            mode: "food",
            pageNo,
            pageSize,
            stores: rows,
        });
    } catch (err) {
        console.error("❌ [food listStores] error:", err);
        return res.status(500).json({ success: false, error: err?.message || "server error" });
    }
}

export async function searchStore(req, res) {
    // listStores와 동일하게 동작(프론트가 /search를 쓰는 경우 대비)
    return listStores(req, res);
}

export async function listCandidates(req, res) {
    // 후보 리스트도 동일(필요하면 여기서 category/subcategory 필터 추가 가능)
    return listStores(req, res);
}

/** ----------------- API: grid (subcategory page hydration) ----------------- */
/**
 * GET /subcategorymanager_food/ad/grid
 * query:
 *  - page=subcategory (기본)
 *  - section=best_seller (필수)
 *  - category=한식 (권장)
 *  - subcategory=국밥 (권장)
 *  - pageNo, pageSize
 *
 * 반환: 슬롯 아이템 배열(items)
 */
export async function grid(req, res) {
    try {
        const cols = await getSlotsColumns();

        const page = clean(req.query.page) || PAGE_NAME;
        const section = clean(req.query.section);
        const category = clean(req.query.category);
        const subcategory = clean(req.query.subcategory);

        const pageNo = Math.max(safeInt(req.query.pageNo, 1), 1);
        const pageSize = clamp(safeInt(req.query.pageSize, 9), 1, 50);

        if (!section) {
            return res.status(400).json({ success: false, error: "section is required" });
        }

        // position prefix로 조회
        const prefix = buildPosition({
            mode: "food",
            category,
            subcategory,
            section,
            idx: "",
        }).replace(/\|$/, ""); // 안전
        // buildPosition은 idx가 ""이면 마지막에 빈칸이 들어가므로 prefix 보정
        const likePrefix = `${prefix}|%`; // 마지막 idx 자리

        // select 컬럼(있는 것만)
        const selectCols = [];
        // id 컬럼명은 환경마다 다를 수 있으니 * 대신 있는 컬럼들 위주 + position은 필수
        if (hasCol(cols, "id")) selectCols.push("id");
        if (hasCol(cols, "page")) selectCols.push("page");
        if (hasCol(cols, "position")) selectCols.push("position");

        // 컨텐츠 관련
        if (hasCol(cols, "slot_type")) selectCols.push("slot_type");
        if (hasCol(cols, "slot_mode")) selectCols.push("slot_mode");
        if (hasCol(cols, "image_url")) selectCols.push("image_url");
        if (hasCol(cols, "link_url")) selectCols.push("link_url");
        if (hasCol(cols, "title")) selectCols.push("title");
        if (hasCol(cols, "subtitle")) selectCols.push("subtitle");
        if (hasCol(cols, "text")) selectCols.push("text");
        if (hasCol(cols, "store_id")) selectCols.push("store_id");
        if (hasCol(cols, "business_no")) selectCols.push("business_no");
        if (hasCol(cols, "business_number")) selectCols.push("business_number");
        if (hasCol(cols, "business_name")) selectCols.push("business_name");
        if (hasCol(cols, "business_type")) selectCols.push("business_type");
        if (hasCol(cols, "start_date")) selectCols.push("start_date");
        if (hasCol(cols, "end_date")) selectCols.push("end_date");
        if (hasCol(cols, "no_end")) selectCols.push("no_end");
        if (hasCol(cols, "priority")) selectCols.push("priority");
        if (hasCol(cols, "updated_at")) selectCols.push("updated_at");
        if (hasCol(cols, "created_at")) selectCols.push("created_at");

        const selectSql = selectCols.length ? selectCols.join(", ") : "*";

        // ✅ $1~$4 항상 존재(42P02 방지)
        const sql = hasCol(cols, "position")
            ? `
        SELECT ${selectSql}
        FROM ${SLOTS_TABLE}
        WHERE (${hasCol(cols, "page") ? "page = $1 AND " : ""} position LIKE $2)
        ORDER BY
          CASE
            WHEN position IS NULL THEN 999999
            ELSE COALESCE(NULLIF(regexp_replace(position, '.*\\|', ''), ''), '999999')::int
          END ASC
        LIMIT $3 OFFSET $4
      `
            : `
        SELECT ${selectSql}
        FROM ${SLOTS_TABLE}
        WHERE 1=0
        LIMIT $3 OFFSET $4
      `;

        const offset = (pageNo - 1) * pageSize;
        const params = hasCol(cols, "page")
            ? [page, likePrefix, pageSize, offset]
            : ["", likePrefix, pageSize, offset];

        const { rows } = await pool.query(sql, params);

        return res.json({
            success: true,
            mode: "food",
            page,
            section,
            category,
            subcategory,
            pageNo,
            pageSize,
            items: rows,
        });
    } catch (err) {
        console.error("❌ [food grid] error:", err);
        return res.status(500).json({ success: false, error: err?.message || "server error" });
    }
}

/** ----------------- API: slot read/save/delete ----------------- */
export async function getSlot(req, res) {
    try {
        const cols = await getSlotsColumns();

        const page = clean(req.query.page) || PAGE_NAME;
        const section = clean(req.query.section);
        const category = clean(req.query.category);
        const subcategory = clean(req.query.subcategory);
        const idx = Math.max(safeInt(req.query.idx, 1), 1);

        if (!section) return res.status(400).json({ success: false, error: "section is required" });

        if (!hasCol(cols, "position")) {
            return res.status(500).json({ success: false, error: "admin_ad_slots.position column missing" });
        }

        const position = buildPosition({ mode: "food", category, subcategory, section, idx });

        const selectCols = [];
        if (hasCol(cols, "id")) selectCols.push("id");
        if (hasCol(cols, "page")) selectCols.push("page");
        selectCols.push("position"); // 필수

        if (hasCol(cols, "slot_type")) selectCols.push("slot_type");
        if (hasCol(cols, "slot_mode")) selectCols.push("slot_mode");
        if (hasCol(cols, "image_url")) selectCols.push("image_url");
        if (hasCol(cols, "link_url")) selectCols.push("link_url");
        if (hasCol(cols, "title")) selectCols.push("title");
        if (hasCol(cols, "subtitle")) selectCols.push("subtitle");
        if (hasCol(cols, "text")) selectCols.push("text");
        if (hasCol(cols, "store_id")) selectCols.push("store_id");
        if (hasCol(cols, "business_no")) selectCols.push("business_no");
        if (hasCol(cols, "business_number")) selectCols.push("business_number");
        if (hasCol(cols, "business_name")) selectCols.push("business_name");
        if (hasCol(cols, "business_type")) selectCols.push("business_type");
        if (hasCol(cols, "start_date")) selectCols.push("start_date");
        if (hasCol(cols, "end_date")) selectCols.push("end_date");
        if (hasCol(cols, "no_end")) selectCols.push("no_end");
        if (hasCol(cols, "priority")) selectCols.push("priority");
        if (hasCol(cols, "updated_at")) selectCols.push("updated_at");
        if (hasCol(cols, "created_at")) selectCols.push("created_at");

        const sql = `
      SELECT ${selectCols.join(", ")}
      FROM ${SLOTS_TABLE}
      WHERE ${hasCol(cols, "page") ? "page = $1 AND " : ""} position = $2
      LIMIT 1
    `;

        const params = hasCol(cols, "page") ? [page, position] : ["", position];
        const { rows } = await pool.query(sql, params);

        return res.json({
            success: true,
            mode: "food",
            page,
            position,
            slot: rows[0] || null,
        });
    } catch (err) {
        console.error("❌ [food getSlot] error:", err);
        return res.status(500).json({ success: false, error: err?.message || "server error" });
    }
}

export async function upsertSlot(req, res) {
    try {
        const cols = await getSlotsColumns();

        const page = clean(req.body.page) || PAGE_NAME;
        const section = clean(req.body.section);
        const category = clean(req.body.category);
        const subcategory = clean(req.body.subcategory);
        const idx = Math.max(safeInt(req.body.idx, 1), 1);

        if (!section) return res.status(400).json({ success: false, error: "section is required" });

        if (!hasCol(cols, "position")) {
            return res.status(500).json({ success: false, error: "admin_ad_slots.position column missing" });
        }

        const position = buildPosition({ mode: "food", category, subcategory, section, idx });

        // 업로드 이미지가 있으면 image_url 갱신, 없으면 body.image_url 유지
        const uploadedImageUrl = safePublicImageUrl(req.file);
        const bodyImageUrl = clean(req.body.image_url);
        const imageUrl = uploadedImageUrl || bodyImageUrl;

        // 타입/모드
        const slotType = clean(req.body.slot_type || req.body.slotType); // image/text
        const slotMode = clean(req.body.slot_mode || req.body.slotMode); // store/custom

        // 텍스트/링크
        const title = clean(req.body.title);
        const subtitle = clean(req.body.subtitle);
        const text = clean(req.body.text);
        const linkUrl = clean(req.body.link_url || req.body.linkUrl);

        // 가게 연결
        const storeId = clean(req.body.store_id || req.body.storeId);
        const businessNo = digitsOnly(req.body.business_no || req.body.businessNo || req.body.business_number);

        const businessName = clean(req.body.business_name);
        const businessType = clean(req.body.business_type);

        // 기간/우선순위
        const startDate = safeDateOrNull(req.body.start_date);
        const endDate = safeDateOrNull(req.body.end_date);
        const noEnd = toBool(req.body.no_end);
        const priority = safeInt(req.body.priority, 0);

        // 기존 슬롯 이미지 제거 필요할 때 대비(새 이미지 업로드가 있을 때만)
        let oldImageUrl = "";
        if (uploadedImageUrl) {
            // 기존 레코드 조회해서 기존 이미지 제거
            const q = `
        SELECT ${hasCol(cols, "image_url") ? "image_url" : "NULL AS image_url"}
        FROM ${SLOTS_TABLE}
        WHERE ${hasCol(cols, "page") ? "page = $1 AND " : ""} position = $2
        LIMIT 1
      `;
            const p = hasCol(cols, "page") ? [page, position] : ["", position];
            const { rows } = await pool.query(q, p);
            oldImageUrl = rows?.[0]?.image_url || "";
        }

        // INSERT/UPDATE 할 컬럼들: "있는 컬럼만"
        const data = {};
        if (hasCol(cols, "page")) data.page = page;
        data.position = position;

        if (hasCol(cols, "slot_type")) data.slot_type = slotType;
        if (hasCol(cols, "slot_mode")) data.slot_mode = slotMode;

        if (hasCol(cols, "image_url")) data.image_url = imageUrl;
        if (hasCol(cols, "link_url")) data.link_url = linkUrl;

        if (hasCol(cols, "title")) data.title = title;
        if (hasCol(cols, "subtitle")) data.subtitle = subtitle;
        if (hasCol(cols, "text")) data.text = text;

        if (hasCol(cols, "store_id")) data.store_id = storeId || null;

        // business_no / business_number 둘 중 있는 쪽에 저장
        if (hasCol(cols, "business_no")) data.business_no = businessNo;
        if (hasCol(cols, "business_number")) data.business_number = businessNo;

        if (hasCol(cols, "business_name")) data.business_name = businessName;
        if (hasCol(cols, "business_type")) data.business_type = businessType;

        if (hasCol(cols, "start_date")) data.start_date = startDate;
        if (hasCol(cols, "end_date")) data.end_date = endDate;
        if (hasCol(cols, "no_end")) data.no_end = noEnd;

        if (hasCol(cols, "priority")) data.priority = priority;

        if (hasCol(cols, "updated_at")) data.updated_at = new Date().toISOString();

        // category/subcategory를 별도 컬럼으로 저장하는 케이스도 대비(있는 경우만)
        if (hasCol(cols, "category")) data.category = category;
        if (hasCol(cols, "subcategory")) data.subcategory = subcategory;
        if (hasCol(cols, "section")) data.section = section;
        if (hasCol(cols, "idx")) data.idx = idx;
        if (hasCol(cols, "mode")) data.mode = "food";

        // upsert 키: (page, position) 또는 (position) 단독
        // - unique constraint를 모르므로 2단계로 처리: 먼저 UPDATE, 없으면 INSERT
        const setKeys = Object.keys(data).filter((k) => k !== "position" && k !== "page");
        const setSql = setKeys.map((k, n) => `${k} = $${n + 3}`).join(", ");
        const setParams = setKeys.map((k) => data[k]);

        // UPDATE
        const updateSql = `
      UPDATE ${SLOTS_TABLE}
      SET ${setSql || "position = position"}
      WHERE ${hasCol(cols, "page") ? "page = $1 AND " : ""} position = $2
      RETURNING *
    `;
        const updateParams = hasCol(cols, "page")
            ? [page, position, ...setParams]
            : ["", position, ...setParams];

        const upd = await pool.query(updateSql, updateParams);

        let row = upd.rows?.[0];

        if (!row) {
            // INSERT
            const insertKeys = Object.keys(data);
            const insertVals = insertKeys.map((_, n) => `$${n + 1}`).join(", ");
            const insertSql = `
        INSERT INTO ${SLOTS_TABLE} (${insertKeys.join(", ")})
        VALUES (${insertVals})
        RETURNING *
      `;
            const insertParams = insertKeys.map((k) => data[k]);
            const ins = await pool.query(insertSql, insertParams);
            row = ins.rows?.[0] || null;
        }

        // 새 이미지가 들어왔고, 이전 이미지가 우리 업로드면 삭제
        if (uploadedImageUrl && oldImageUrl && oldImageUrl !== uploadedImageUrl) {
            safeUnlinkIfMine(oldImageUrl);
        }

        return res.json({
            success: true,
            mode: "food",
            page,
            position,
            slot: row,
        });
    } catch (err) {
        console.error("❌ [food upsertSlot] error:", err);
        return res.status(500).json({ success: false, error: err?.message || "server error" });
    }
}

export async function deleteSlot(req, res) {
    try {
        const cols = await getSlotsColumns();

        const page = clean(req.query.page) || PAGE_NAME;
        const section = clean(req.query.section);
        const category = clean(req.query.category);
        const subcategory = clean(req.query.subcategory);
        const idx = Math.max(safeInt(req.query.idx, 1), 1);

        if (!section) return res.status(400).json({ success: false, error: "section is required" });
        if (!hasCol(cols, "position")) {
            return res.status(500).json({ success: false, error: "admin_ad_slots.position column missing" });
        }

        const position = buildPosition({ mode: "food", category, subcategory, section, idx });

        // 삭제 전 이미지 확인(있으면 제거)
        let imageUrl = "";
        if (hasCol(cols, "image_url")) {
            const q = `
        SELECT image_url
        FROM ${SLOTS_TABLE}
        WHERE ${hasCol(cols, "page") ? "page = $1 AND " : ""} position = $2
        LIMIT 1
      `;
            const p = hasCol(cols, "page") ? [page, position] : ["", position];
            const { rows } = await pool.query(q, p);
            imageUrl = rows?.[0]?.image_url || "";
        }

        const delSql = `
      DELETE FROM ${SLOTS_TABLE}
      WHERE ${hasCol(cols, "page") ? "page = $1 AND " : ""} position = $2
    `;
        const delParams = hasCol(cols, "page") ? [page, position] : ["", position];

        const r = await pool.query(delSql, delParams);

        if (imageUrl) safeUnlinkIfMine(imageUrl);

        return res.json({
            success: true,
            mode: "food",
            page,
            position,
            deleted: r.rowCount || 0,
        });
    } catch (err) {
        console.error("❌ [food deleteSlot] error:", err);
        return res.status(500).json({ success: false, error: err?.message || "server error" });
    }
}
