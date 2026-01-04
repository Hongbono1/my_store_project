// controllers/ndetailmanagerAdController.js
import fs from "fs";
import path from "path";
import crypto from "crypto";
import pool from "../db.js";

/**
 * ----------------------------------------------------------
 *  NDETAIL Manager - Controller (FULL)
 *  - Upload dir: /data/uploads/manager_ad (영구)
 *  - Public URL: /uploads/manager_ad/*
 *  - Slot table: public.admin_ad_slots (기존 재사용)
 *  - Store search:
 *      food     -> public.store_info  (또는 public.food_stores 등 후보)
 *      combined -> public.combined_store_info
 *
 *  FIXES:
 *   1) 검색(q 있을 때)에서도 store_info 대표이미지를 store_images에서 1장 JOIN해서 내려줌
 *   2) 슬롯 저장 시 store_type / table_source 컬럼도 함께 저장(메뉴 타입 꼬임 방지)
 *   3) 컬럼 alias(s.) 정리, 안전한 select 구성
 * ----------------------------------------------------------
 */

export const UPLOAD_SUBDIR = "manager_ad";
export const UPLOAD_ABS_DIR = path.join("/data/uploads", UPLOAD_SUBDIR);
export const UPLOAD_PUBLIC_PREFIX = `/uploads/${UPLOAD_SUBDIR}`;

const SLOTS_TABLE = "public.admin_ad_slots";
const COMBINED_TABLE = "public.combined_store_info";

// food 후보(네 환경에서 존재하는 첫 번째를 쓰는 방식)
const FOOD_TABLE_CANDIDATES = [
    "public.store_info",
    "public.food_stores",
    "public.food_store_info",
    "public.food_store",
];

// ---------- 공통 ----------
function ensureUploadDir() {
    fs.mkdirSync(UPLOAD_ABS_DIR, { recursive: true });
}

function safeInt(v, def = 1) {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return def;
    return Math.floor(n);
}

function normalizeBool(v) {
    if (v === true || v === "true" || v === "1" || v === 1) return true;
    return false;
}

function normalizeDateOrNull(v) {
    if (!v) return null;
    const s = String(v).trim();
    if (!s) return null;
    return s; // YYYY-MM-DD 그대로 저장
}

function newFilename(originalName = "") {
    const ext = path.extname(originalName).toLowerCase() || ".jpg";
    return `${Date.now()}_${crypto.randomUUID()}${ext}`;
}

function asPublicUrl(filename) {
    if (!filename) return "";
    if (filename.startsWith("/")) return filename;
    return `${UPLOAD_PUBLIC_PREFIX}/${filename}`;
}

async function tableExists(tableName) {
    const [schema, name] = tableName.split(".");
    const q = `
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema=$1 AND table_name=$2
    LIMIT 1
  `;
    const r = await pool.query(q, [schema, name]);
    return r.rowCount > 0;
}

async function pickFoodTable() {
    for (const t of FOOD_TABLE_CANDIDATES) {
        // eslint-disable-next-line no-await-in-loop
        if (await tableExists(t)) return t;
    }
    return "public.store_info";
}

async function getColumns(tableName) {
    const [schema, name] = tableName.split(".");
    const q = `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema=$1 AND table_name=$2
  `;
    const r = await pool.query(q, [schema, name]);
    return new Set((r.rows || []).map((x) => x.column_name));
}

function buildImageSelect(cols, alias = "s") {
    const candidates = ["main_image_url", "image_url", "main_image", "image1", "image"];
    const exist = candidates.filter((c) => cols.has(c));
    if (exist.length === 0) return `''::text AS image_url`;
    // s.main_image_url, s.image_url ... 를 COALESCE로 묶음
    const expr = exist.map((c) => `${alias}.${c}`).join(", ");
    return `COALESCE(${expr}, '') AS image_url`;
}

// ---------- Slots ----------
export async function getSlot(req, res) {
    try {
        const position = String(req.query.position || "").trim();
        console.log("[ndetailmanager:getSlot] 요청 position:", position);
        if (!position) return res.status(400).json({ success: false, message: "position required" });

        const q = `
      SELECT *
      FROM ${SLOTS_TABLE}
      WHERE page='ndetail' AND position=$1
      LIMIT 1
    `;

        const r = await pool.query(q, [position]);
        const slot = r.rows?.[0] || null;

        return res.json({ success: true, slot });
    } catch (e) {
        console.error("[ndetailmanager:getSlot] 에러:", e);
        return res.status(500).json({ success: false, message: "server error" });
    }
}

export async function upsertSlot(req, res) {
    try {
        const body = req.body || {};
        const position = String(body.position || "").trim();
        if (!position) return res.status(400).json({ success: false, message: "position required" });

        const slot_type = String(body.slot_type || "image").trim(); // image | text
        const slot_mode = String(body.slot_mode || "custom").trim(); // custom | store

        // ✅ DB 컬럼명은 text_content
        const text_content = String(body.text_content ?? body.text ?? "");
        const link_url = String(body.link_url || "");

        const start_date = normalizeDateOrNull(body.start_date);
        const end_date = normalizeDateOrNull(body.end_date);
        const no_end = normalizeBool(body.no_end);
        const priority = safeInt(body.priority, 1);

        const store_id = body.store_id !== undefined && body.store_id !== null && String(body.store_id).trim() !== ""
            ? Number(body.store_id)
            : null;

        const business_no = String(body.business_no || "");
        const business_name = String(body.business_name || "");

        // ✅ (추가) store_type / table_source 저장 (menu 타입 꼬임 방지)
        // - 프론트가 mode( food/combined )를 넘겨주면 store_type에 저장 가능
        const store_type = String(body.store_type || body.mode || "").trim(); // "food" | "combined"
        const table_source = String(body.table_source || "").trim();          // optional

        // 파일 업로드가 있으면 저장 + URL 만들기
        let image_url = "";
        if (req.file?.filename) {
            image_url = asPublicUrl(req.file.filename);
        } else if (body.image_url) {
            image_url = String(body.image_url);
        }

        // 기존 레코드 확인(업데이트 vs 삽입)
        const findQ = `SELECT id, image_url FROM ${SLOTS_TABLE} WHERE page='ndetail' AND position=$1 LIMIT 1`;
        const found = await pool.query(findQ, [position]);
        const existing = found.rows?.[0] || null;

        // 새 이미지 업로드 시, 기존 이미지 파일 삭제(가능하면)
        if (req.file?.filename && existing?.image_url) {
            try {
                const old = String(existing.image_url);
                if (old.startsWith(UPLOAD_PUBLIC_PREFIX + "/")) {
                    const oldName = old.replace(UPLOAD_PUBLIC_PREFIX + "/", "");
                    const oldAbs = path.join(UPLOAD_ABS_DIR, oldName);
                    if (fs.existsSync(oldAbs)) fs.unlinkSync(oldAbs);
                }
            } catch (e) {
                console.warn("[ndetailmanager] old image delete skipped:", e?.message);
            }
        }

        if (existing) {
            const uq = `
        UPDATE ${SLOTS_TABLE}
        SET
          slot_type=$2,
          slot_mode=$3,
          image_url=$4,
          text_content=$5,
          link_url=$6,
          start_date=$7,
          end_date=$8,
          no_end=$9,
          priority=$10,
          store_id=$11,
          business_no=$12,
          business_name=$13,
          store_type=$14,
          table_source=$15,
          updated_at=NOW()
        WHERE page='ndetail' AND position=$1
        RETURNING *
      `;

            const ur = await pool.query(uq, [
                position,
                slot_type,
                slot_mode,
                image_url,
                text_content,
                link_url,
                start_date,
                end_date,
                no_end,
                priority,
                store_id,
                business_no,
                business_name,
                store_type,
                table_source,
            ]);

            return res.json({ success: true, slot: ur.rows?.[0] || null });
        }

        const iq = `
      INSERT INTO ${SLOTS_TABLE} (
        page, position, slot_type, slot_mode,
        image_url, text_content, link_url,
        start_date, end_date, no_end,
        priority, store_id, business_no, business_name,
        store_type, table_source,
        created_at, updated_at
      )
      VALUES (
        $1, $2, $3, $4,
        $5, $6, $7,
        $8, $9, $10,
        $11, $12, $13, $14,
        $15, $16,
        NOW(), NOW()
      )
      RETURNING *
    `;

        const page = "ndetail";
        const ir = await pool.query(iq, [
            page,
            position,
            slot_type,
            slot_mode,
            image_url,
            text_content,
            link_url,
            start_date,
            end_date,
            no_end,
            priority,
            store_id,
            business_no,
            business_name,
            store_type,
            table_source,
        ]);

        return res.json({ success: true, slot: ir.rows?.[0] || null });
    } catch (e) {
        console.error("[ndetailmanager:upsertSlot]", e);
        return res.status(500).json({ success: false, message: "server error" });
    }
}

export async function deleteSlot(req, res) {
    try {
        const position = String(req.query.position || "").trim();
        if (!position) return res.status(400).json({ success: false, message: "position required" });

        // 이미지 삭제 시도
        const findQ = `SELECT id, image_url FROM ${SLOTS_TABLE} WHERE page='ndetail' AND position=$1 LIMIT 1`;
        const found = await pool.query(findQ, [position]);
        const existing = found.rows?.[0] || null;

        if (!existing) return res.json({ success: true, deleted: false });

        if (existing.image_url) {
            try {
                const old = String(existing.image_url);
                if (old.startsWith(UPLOAD_PUBLIC_PREFIX + "/")) {
                    const oldName = old.replace(UPLOAD_PUBLIC_PREFIX + "/", "");
                    const oldAbs = path.join(UPLOAD_ABS_DIR, oldName);
                    if (fs.existsSync(oldAbs)) fs.unlinkSync(oldAbs);
                }
            } catch (e) {
                console.warn("[ndetailmanager] old image delete skipped:", e?.message);
            }
        }

        const dq = `DELETE FROM ${SLOTS_TABLE} WHERE page='ndetail' AND position=$1`;
        await pool.query(dq, [position]);
        return res.json({ success: true, deleted: true });
    } catch (e) {
        console.error("[ndetailmanager:deleteSlot]", e);
        return res.status(500).json({ success: false, message: "server error" });
    }
}

// ---------- Store Search ----------
export async function searchStore(req, res) {
    try {
        const q = String(req.query.q || "").trim();
        const mode = String(req.query.mode || "food").trim().toLowerCase();

        let table = "";
        if (mode === "combined") table = COMBINED_TABLE;
        else table = await pickFoodTable();

        // ✅ food(store_info) 대표 이미지: public.store_images에서 1장 가져오기
        const useFoodImagesJoin =
            mode !== "combined" &&
            table === "public.store_info" &&
            (await tableExists("public.store_images"));

        const foodImagesJoin = useFoodImagesJoin
            ? `LEFT JOIN LATERAL (
           SELECT url
           FROM public.store_images
           WHERE store_id = s.id
           ORDER BY id ASC
           LIMIT 1
         ) img ON true`
            : "";

        // 컬럼 동적 확인
        const cols = await getColumns(table);

        const hasBN = cols.has("business_number");
        const hasName = cols.has("business_name");
        const hasType = cols.has("business_type");
        const hasCat = cols.has("business_category");

        const bnSel = hasBN ? "s.business_number" : "''::text";
        const nameSel = hasName ? "s.business_name" : "''::text";
        const typeSel = hasType ? "s.business_type" : "''::text";
        const catSel = hasCat ? "s.business_category" : "''::text";

        const imageSelect = buildImageSelect(cols, "s");
        const imageSelFinal = useFoodImagesJoin ? "COALESCE(img.url, '') AS image_url" : imageSelect;

        // ✅ q가 없으면 최근 10개
        if (!q) {
            const sqlRecent = `
        SELECT
          s.id,
          ${bnSel} AS business_number,
          ${nameSel} AS business_name,
          ${typeSel} AS business_type,
          ${catSel} AS business_category,
          ${imageSelFinal}
        FROM ${table} s
        ${foodImagesJoin}
        ORDER BY s.id DESC
        LIMIT 10
      `;
            const r = await pool.query(sqlRecent);
            return res.json({ success: true, mode, q: "", results: r.rows || [] });
        }

        // ✅ q 있을 때 검색 (중요: 여기에도 foodImagesJoin 적용)
        const sql = `
      SELECT
        s.id,
        ${bnSel} AS business_number,
        ${nameSel} AS business_name,
        ${typeSel} AS business_type,
        ${catSel} AS business_category,
        ${imageSelFinal}
      FROM ${table} s
      ${foodImagesJoin}
      WHERE
        ${hasBN ? "s.business_number ILIKE $1" : "FALSE"}
        OR
        ${hasName ? "s.business_name ILIKE $1" : "FALSE"}
      ORDER BY s.id DESC
      LIMIT 30
    `;

        const like = `%${q}%`;
        const r = await pool.query(sql, [like]);
        return res.json({ success: true, mode, q, results: r.rows || [] });
    } catch (e) {
        console.error("[ndetailmanager:searchStore]", e);
        return res.status(500).json({ success: false, message: "server error" });
    }
}

// 초기화(업로드 폴더)
ensureUploadDir();
