// controllers/ndetailmanagerAdController.js
import fs from "fs";
import path from "path";
import crypto from "crypto";
import pool from "../db.js";

/**
 * ----------------------------------------------------------
 *  NDETAIL Manager - Controller
 *  - Upload dir: /data/uploads/manager_ad (기존 정책 그대로 사용)
 *  - Public path: /uploads/manager_ad/...
 *  - Slot table: public.admin_ad_slots (기존 재사용)
 *  - Page key: "ndetail"
 *  - Position key: "ndetail|<section>"
 * ----------------------------------------------------------
 */

export const UPLOAD_SUBDIR = "manager_ad";
export const UPLOAD_ABS_DIR = path.join("/data/uploads", UPLOAD_SUBDIR);
export const UPLOAD_PUBLIC_PREFIX = `/uploads/${UPLOAD_SUBDIR}`;

const SLOTS_TABLE = "public.admin_ad_slots";

function ensureUploadDir() {
  fs.mkdirSync(UPLOAD_ABS_DIR, { recursive: true });
}

export function makeMulterStorage() {
  ensureUploadDir();
  return {
    destination(req, file, cb) {
      cb(null, UPLOAD_ABS_DIR);
    },
    filename(req, file, cb) {
      const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
      const safeExt = [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext) ? ext : ".jpg";
      const name = `${Date.now()}_${crypto.randomBytes(8).toString("hex")}${safeExt}`;
      cb(null, name);
    },
  };
}

export function fileFilter(req, file, cb) {
  const ok = /^image\/(png|jpe?g|webp|gif)$/i.test(file.mimetype || "");
  if (!ok) return cb(new Error("Only image files are allowed."), false);
  cb(null, true);
}

function safeBool(v) {
  if (v === true || v === "true" || v === 1 || v === "1") return true;
  return false;
}
function safeInt(v, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

async function getSlotRow(page, position) {
  const { rows } = await pool.query(
    `SELECT * FROM ${SLOTS_TABLE} WHERE page=$1 AND position=$2 LIMIT 1`,
    [page, position]
  );
  return rows[0] || null;
}

function tryUnlinkByPublicUrl(imageUrl) {
  try {
    if (!imageUrl) return;
    if (!imageUrl.startsWith(UPLOAD_PUBLIC_PREFIX + "/")) return;
    const filename = imageUrl.replace(UPLOAD_PUBLIC_PREFIX + "/", "");
    const abs = path.join(UPLOAD_ABS_DIR, filename);
    if (abs.startsWith(UPLOAD_ABS_DIR) && fs.existsSync(abs)) fs.unlinkSync(abs);
  } catch (e) {
    // ignore
  }
}

/**
 * GET /ndetailmanager/ad/slot?position=ndetail|images
 */
export async function getSlot(req, res) {
  try {
    const position = String(req.query.position || "").trim();
    if (!position) return res.status(400).json({ success: false, message: "position is required" });

    const slot = await getSlotRow("ndetail", position);
    return res.json({ success: true, slot: slot || null });
  } catch (e) {
    console.error("[ndetailmanager] getSlot error:", e);
    return res.status(500).json({ success: false, message: "server error" });
  }
}

/**
 * POST /ndetailmanager/ad/update  (multipart/form-data)
 * fields:
 *  - position (required)
 *  - slot_type: image|text
 *  - slot_mode: custom|store
 *  - text
 *  - link_url
 *  - store_id, business_no, business_name
 *  - start_date, end_date, no_end, priority
 * file:
 *  - image (optional)
 */
export async function upsertSlot(req, res) {
  try {
    const page = "ndetail";
    const position = String(req.body.position || "").trim();
    if (!position) return res.status(400).json({ success: false, message: "position is required" });

    const slot_type = String(req.body.slot_type || "text").trim(); // image|text
    const slot_mode = String(req.body.slot_mode || "custom").trim(); // custom|store

    const text = String(req.body.text || "");
    const link_url = String(req.body.link_url || "");

    const store_id = req.body.store_id ? String(req.body.store_id) : null;
    const business_no = req.body.business_no ? String(req.body.business_no) : "";
    const business_name = req.body.business_name ? String(req.body.business_name) : "";

    const start_date = req.body.start_date ? String(req.body.start_date) : null;
    const end_date = req.body.end_date ? String(req.body.end_date) : null;
    const no_end = safeBool(req.body.no_end);
    const priority = safeInt(req.body.priority, 1);

    let newImageUrl = null;
    if (req.file?.filename) {
      newImageUrl = `${UPLOAD_PUBLIC_PREFIX}/${req.file.filename}`;
    }

    const existing = await getSlotRow(page, position);

    if (!existing) {
      const { rows } = await pool.query(
        `
        INSERT INTO ${SLOTS_TABLE}
          (page, position, slot_type, slot_mode, image_url, text, link_url,
           store_id, business_no, business_name,
           start_date, end_date, no_end, priority, created_at, updated_at)
        VALUES
          ($1,$2,$3,$4,$5,$6,$7,
           $8,$9,$10,
           $11,$12,$13,$14, NOW(), NOW())
        RETURNING *
        `,
        [
          page,
          position,
          slot_type,
          slot_mode,
          newImageUrl || "",
          text,
          link_url,
          store_id,
          business_no,
          business_name,
          start_date,
          no_end ? null : end_date,
          no_end,
          priority,
        ]
      );
      return res.json({ success: true, slot: rows[0] });
    }

    // 기존 이미지가 있고 새 이미지 업로드면 기존 파일 삭제(우리 업로드 폴더인 경우만)
    if (newImageUrl) {
      tryUnlinkByPublicUrl(existing.image_url);
    }

    const finalImage = newImageUrl != null ? newImageUrl : (existing.image_url || "");

    const { rows } = await pool.query(
      `
      UPDATE ${SLOTS_TABLE}
      SET
        slot_type=$3,
        slot_mode=$4,
        image_url=$5,
        text=$6,
        link_url=$7,
        store_id=$8,
        business_no=$9,
        business_name=$10,
        start_date=$11,
        end_date=$12,
        no_end=$13,
        priority=$14,
        updated_at=NOW()
      WHERE page=$1 AND position=$2
      RETURNING *
      `,
      [
        page,
        position,
        slot_type,
        slot_mode,
        finalImage,
        text,
        link_url,
        store_id,
        business_no,
        business_name,
        start_date,
        no_end ? null : end_date,
        no_end,
        priority,
      ]
    );

    return res.json({ success: true, slot: rows[0] });
  } catch (e) {
    console.error("[ndetailmanager] upsertSlot error:", e);
    return res.status(500).json({ success: false, message: "server error" });
  }
}

/**
 * DELETE /ndetailmanager/ad/delete?position=ndetail|images
 */
export async function deleteSlot(req, res) {
  try {
    const position = String(req.query.position || "").trim();
    if (!position) return res.status(400).json({ success: false, message: "position is required" });

    const existing = await getSlotRow("ndetail", position);
    if (!existing) return res.json({ success: true, deleted: false });

    // 파일 삭제(우리 업로드 폴더일 때만)
    tryUnlinkByPublicUrl(existing.image_url);

    await pool.query(`DELETE FROM ${SLOTS_TABLE} WHERE page=$1 AND position=$2`, ["ndetail", position]);

    return res.json({ success: true, deleted: true });
  } catch (e) {
    console.error("[ndetailmanager] deleteSlot error:", e);
    return res.status(500).json({ success: false, message: "server error" });
  }
}

/**
 * GET /ndetailmanager/ad/search-store?q=...&mode=food|combined
 * - ndetailmanager에서 "가게 연결" 모드용
 */
export async function searchStore(req, res) {
  try {
    const q = String(req.query.q || "").trim();
    const mode = String(req.query.mode || "food").trim(); // food|combined
    if (!q) return res.json({ success: true, mode, q, results: [] });

    // 검색키: 숫자 위주면 사업자번호로, 아니면 상호명
    const isBizNo = /^[0-9\-]+$/.test(q);

    let table = null;
    if (mode === "combined") {
      table = "public.combined_store_info";
    } else {
      // food 후보
      const candidates = [
        "public.food_stores",
        "public.store_info",
        "public.food_store_info",
        "public.food_store",
      ];
      // 존재하는 테이블 하나 고르기
      for (const t of candidates) {
        const { rows } = await pool.query(`SELECT to_regclass($1) AS reg`, [t]);
        if (rows?.[0]?.reg) {
          table = t;
          break;
        }
      }
      if (!table) table = "public.store_info";
    }

    const where = isBizNo
      ? `(COALESCE(business_number,'') ILIKE $1 OR COALESCE(business_no,'') ILIKE $1)`
      : `(COALESCE(business_name,'') ILIKE $1 OR COALESCE(name,'') ILIKE $1)`;

    const { rows } = await pool.query(
      `
      SELECT
        id::text AS id,
        COALESCE(business_number, business_no, '') AS business_number,
        COALESCE(business_name, name, '') AS business_name,
        COALESCE(business_type, '') AS business_type,
        COALESCE(business_category, category, '') AS business_category,
        COALESCE(main_image_url, image_url, '') AS image_url
      FROM ${table}
      WHERE ${where}
      ORDER BY id DESC
      LIMIT 20
      `,
      [`%${q}%`]
    );

    return res.json({ success: true, mode, q, results: rows || [] });
  } catch (e) {
    console.error("[ndetailmanager] searchStore error:", e);
    return res.status(500).json({ success: false, message: "server error" });
  }
}
