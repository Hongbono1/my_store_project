// controllers/foodcategorymanagerAdController.js
import pool from "../db.js";
import fs from "fs";
import path from "path";

const TZ = "Asia/Seoul";
const UPLOAD_ROOT = process.env.UPLOAD_ROOT || "/data/uploads";
const ADS_DIR = path.join(UPLOAD_ROOT, "ads"); // /data/uploads/ads

function ensureDir(p) { try { fs.mkdirSync(p, { recursive: true }); } catch {} }
ensureDir(ADS_DIR);

function clean(v) {
  if (v === undefined || v === null) return "";
  return String(v).trim();
}
function toBool(v) {
  const s = clean(v).toLowerCase();
  return s === "true" || s === "1" || s === "y" || s === "yes" || s === "on";
}

// datetime-local(YYYY-MM-DDTHH:mm)를 KST(+09:00) 기준으로 timestamptz로 저장
function toTimestamptzFromLocal(localStr) {
  const s = clean(localStr);
  if (!s) return null;

  if (/[zZ]$/.test(s) || /[+-]\d\d:\d\d$/.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const withSec = s.length === 16 ? `${s}:00` : s;
  const d = new Date(`${withSec}+09:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function publicUrlFromFilename(filename) {
  return `/uploads/ads/${filename}`;
}

function tryUnlinkByImageUrl(imageUrl) {
  const u = clean(imageUrl);
  if (!u.startsWith("/uploads/")) return;

  const rel = u.replace(/^\/uploads\//, "");   // ads/xxx.png
  const abs = path.join(UPLOAD_ROOT, rel);     // /data/uploads/ads/xxx.png

  try { if (fs.existsSync(abs)) fs.unlinkSync(abs); } catch {}
}

// ✅ GET /manager/ad/slot?page=...&position=...[&priority=...]
export async function getSlot(req, res) {
  try {
    const page = clean(req.query.page);
    const position = clean(req.query.position);
    const pri = clean(req.query.priority);
    const priority = pri ? Number(pri) : null;

    if (!page || !position) {
      return res.status(400).json({ success: false, error: "page/position required" });
    }

    let q = `
      SELECT
        id, page, position, priority,
        slot_type, slot_mode,
        image_url, link_url,
        store_id, business_no, business_name,
        text_content,
        no_end,
        start_at,
        end_at,
        to_char(start_at AT TIME ZONE '${TZ}', 'YYYY-MM-DD"T"HH24:MI') AS start_at_local,
        to_char(end_at   AT TIME ZONE '${TZ}', 'YYYY-MM-DD"T"HH24:MI') AS end_at_local
      FROM public.admin_ad_slots
      WHERE page = $1 AND position = $2
    `;
    const params = [page, position];

    if (priority === null) q += ` AND priority IS NULL `;
    else { q += ` AND priority = $3 `; params.push(priority); }

    q += ` ORDER BY updated_at DESC LIMIT 1`;

    const { rows } = await pool.query(q, params);
    return res.json({ success: true, slot: rows[0] || null });
  } catch (e) {
    console.error("getSlot error:", e);
    return res.status(500).json({ success: false, error: "server error" });
  }
}

// ✅ POST /manager/ad/slot (multipart/form-data, image 필드명: image)
export async function saveSlot(req, res) {
  try {
    const b = req.body || {};
    const page = clean(b.page);
    const position = clean(b.position);
    const pri = clean(b.priority);
    const priority = pri ? Number(pri) : null;

    const slotType = clean(b.slotType) || "banner";
    const slotMode = clean(b.slotMode) || "banner";

    const linkUrl = clean(b.linkUrl);
    const textContent = clean(b.textContent);

    const storeId = clean(b.storeId);
    const businessNo = clean(b.businessNo);
    const businessName = clean(b.businessName);

    const startAt = toTimestamptzFromLocal(b.startAt);
    const endAt = toTimestamptzFromLocal(b.endAt);
    const noEnd = toBool(b.noEnd);

    const keepImage = toBool(b.keepImage);
    const clearImage = toBool(b.clearImage);

    if (!page || !position) {
      return res.status(400).json({ success: false, error: "page/position required" });
    }

    // ✅ 기존 데이터 조회
    let existing = null;
    {
      const q = `
        SELECT * FROM public.admin_ad_slots
        WHERE page=$1 AND position=$2
        ${priority === null ? "AND priority IS NULL" : "AND priority = $3"}
        ORDER BY updated_at DESC LIMIT 1
      `;
      const params = priority === null ? [page, position] : [page, position, priority];
      const { rows } = await pool.query(q, params);
      existing = rows[0] || null;
    }

    // ✅ 이미지 결정
    let imageUrlFinal = existing?.image_url || null;

    if (clearImage) {
      tryUnlinkByImageUrl(imageUrlFinal);
      imageUrlFinal = null;
    }

    if (req.file && req.file.filename) {
      if (imageUrlFinal) tryUnlinkByImageUrl(imageUrlFinal);
      imageUrlFinal = publicUrlFromFilename(req.file.filename);
    } else {
      // 파일 없으면 기본 유지(keepImage 체크는 "그대로 둔다" 의미)
      if (!existing && !keepImage) imageUrlFinal = imageUrlFinal || null;
    }

    // ✅ mode별 정리
    let store_id_final = null;
    let business_no_final = null;
    let business_name_final = null;
    let text_content_final = null;
    let link_url_final = null;

    if (slotMode === "store") {
      store_id_final = storeId || null;
      business_no_final = businessNo || null;
      business_name_final = businessName || null;
      link_url_final = linkUrl || null;
    } else if (slotMode === "text") {
      text_content_final = textContent || null;
      link_url_final = null;
    } else {
      link_url_final = linkUrl || null;
    }

    const start_at_final = startAt || null;
    const end_at_final = noEnd ? null : (endAt || null);

    // ✅ UPSERT
    let sql = "";
    let params = [];

    if (priority === null) {
      sql = `
        INSERT INTO public.admin_ad_slots
          (page, position, priority, slot_type, slot_mode,
           image_url, link_url,
           store_id, business_no, business_name,
           text_content,
           start_at, end_at, no_end, updated_at)
        VALUES
          ($1, $2, NULL, $3, $4,
           $5, $6,
           $7, $8, $9,
           $10,
           $11, $12, $13, now())
        ON CONFLICT (page, position) WHERE priority IS NULL
        DO UPDATE SET
          slot_type = EXCLUDED.slot_type,
          slot_mode = EXCLUDED.slot_mode,
          image_url = EXCLUDED.image_url,
          link_url = EXCLUDED.link_url,
          store_id = EXCLUDED.store_id,
          business_no = EXCLUDED.business_no,
          business_name = EXCLUDED.business_name,
          text_content = EXCLUDED.text_content,
          start_at = EXCLUDED.start_at,
          end_at = EXCLUDED.end_at,
          no_end = EXCLUDED.no_end,
          updated_at = now()
        RETURNING
          id, page, position, priority,
          slot_type, slot_mode,
          image_url, link_url,
          store_id, business_no, business_name,
          text_content, no_end,
          start_at, end_at,
          to_char(start_at AT TIME ZONE '${TZ}', 'YYYY-MM-DD"T"HH24:MI') AS start_at_local,
          to_char(end_at   AT TIME ZONE '${TZ}', 'YYYY-MM-DD"T"HH24:MI') AS end_at_local
      `;
      params = [
        page, position,
        slotType, slotMode,
        imageUrlFinal, link_url_final,
        store_id_final, business_no_final, business_name_final,
        text_content_final,
        start_at_final, end_at_final, noEnd
      ];
    } else {
      sql = `
        INSERT INTO public.admin_ad_slots
          (page, position, priority, slot_type, slot_mode,
           image_url, link_url,
           store_id, business_no, business_name,
           text_content,
           start_at, end_at, no_end, updated_at)
        VALUES
          ($1, $2, $3, $4, $5,
           $6, $7,
           $8, $9, $10,
           $11,
           $12, $13, $14, now())
        ON CONFLICT (page, position, priority) WHERE priority IS NOT NULL
        DO UPDATE SET
          slot_type = EXCLUDED.slot_type,
          slot_mode = EXCLUDED.slot_mode,
          image_url = EXCLUDED.image_url,
          link_url = EXCLUDED.link_url,
          store_id = EXCLUDED.store_id,
          business_no = EXCLUDED.business_no,
          business_name = EXCLUDED.business_name,
          text_content = EXCLUDED.text_content,
          start_at = EXCLUDED.start_at,
          end_at = EXCLUDED.end_at,
          no_end = EXCLUDED.no_end,
          updated_at = now()
        RETURNING
          id, page, position, priority,
          slot_type, slot_mode,
          image_url, link_url,
          store_id, business_no, business_name,
          text_content, no_end,
          start_at, end_at,
          to_char(start_at AT TIME ZONE '${TZ}', 'YYYY-MM-DD"T"HH24:MI') AS start_at_local,
          to_char(end_at   AT TIME ZONE '${TZ}', 'YYYY-MM-DD"T"HH24:MI') AS end_at_local
      `;
      params = [
        page, position, priority,
        slotType, slotMode,
        imageUrlFinal, link_url_final,
        store_id_final, business_no_final, business_name_final,
        text_content_final,
        start_at_final, end_at_final, noEnd
      ];
    }

    const { rows } = await pool.query(sql, params);
    return res.json({ success: true, slot: rows[0] });
  } catch (e) {
    console.error("saveSlot error:", e);
    return res.status(500).json({ success: false, error: "server error" });
  }
}

// ✅ DELETE /manager/ad/slot?page=...&position=...[&priority=...]
export async function deleteSlot(req, res) {
  try {
    const page = clean(req.query.page);
    const position = clean(req.query.position);
    const pri = clean(req.query.priority);
    const priority = pri ? Number(pri) : null;

    if (!page || !position) {
      return res.status(400).json({ success: false, error: "page/position required" });
    }

    const sel = `
      SELECT image_url FROM public.admin_ad_slots
      WHERE page=$1 AND position=$2
      ${priority === null ? "AND priority IS NULL" : "AND priority=$3"}
      ORDER BY updated_at DESC LIMIT 1
    `;
    const selParams = priority === null ? [page, position] : [page, position, priority];
    const { rows: ex } = await pool.query(sel, selParams);

    const del = `
      DELETE FROM public.admin_ad_slots
      WHERE page=$1 AND position=$2
      ${priority === null ? "AND priority IS NULL" : "AND priority=$3"}
    `;
    const delParams = priority === null ? [page, position] : [page, position, priority];
    await pool.query(del, delParams);

    const imageUrl = ex?.[0]?.image_url || "";
    if (imageUrl) tryUnlinkByImageUrl(imageUrl);

    return res.json({ success: true });
  } catch (e) {
    console.error("deleteSlot error:", e);
    return res.status(500).json({ success: false, error: "server error" });
  }
}

// ✅ GET /manager/ad/store/search?bizNo=...&q=...
export async function searchStore(req, res) {
  try {
    const bizNoRaw = clean(req.query.bizNo);
    const q = clean(req.query.q);

    const bizDigits = bizNoRaw.replace(/[^\d]/g, "");
    const bizLike = bizDigits ? bizDigits : "";

    const sql = `
      SELECT
        id::text AS id,
        regexp_replace(COALESCE(business_number::text,''), '[^0-9]', '', 'g') AS business_no,
        business_name,
        COALESCE(category,'') AS category
      FROM public.combined_store_info
      WHERE
        ($1 = '' OR regexp_replace(COALESCE(business_number::text,''), '[^0-9]', '', 'g') LIKE $1 || '%')
        AND
        ($2 = '' OR business_name ILIKE '%' || $2 || '%')
      ORDER BY id DESC
      LIMIT 30
    `;
    const { rows } = await pool.query(sql, [bizLike, q]);

    return res.json({ ok: true, stores: rows });
  } catch (e) {
    console.error("searchStore error:", e);
    return res.status(500).json({ ok: false, error: "server error" });
  }
}
