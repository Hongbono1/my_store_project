// controllers/foodcategorymanagerAdController.js
import fs from "fs";
import path from "path";
import pool from "../db.js";

const TZ = "Asia/Seoul";
const UPLOAD_DIR = process.env.UPLOAD_DIR || "/data/uploads";
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

function clean(v) {
  if (v === undefined || v === null) return "";
  return String(v).trim();
}
function toBool(v) {
  const s = String(v || "").toLowerCase().trim();
  return s === "true" || s === "1" || s === "yes" || s === "y" || s === "on";
}
function digitsOnly(v) {
  return clean(v).replace(/[^\d]/g, "");
}

async function fetchSlot({ page, position, priority }) {
  const baseSelect = `
    SELECT
      s.id,
      s.page,
      s.position,
      s.priority,
      s.image_url,
      s.link_url,
      s.slot_type,
      s.slot_mode,
      s.text_content,
      s.store_id::text AS store_id,
      s.business_no,
      s.business_name,
      s.no_end,
      -- ✅ 업종: store_info → 없으면 combined_store_info
      COALESCE(f.detail_category, f.business_category, c.business_category) AS category,
      to_char(s.start_at AT TIME ZONE '${TZ}', 'YYYY-MM-DD"T"HH24:MI') AS start_at_local,
      to_char(s.end_at   AT TIME ZONE '${TZ}', 'YYYY-MM-DD"T"HH24:MI') AS end_at_local
    FROM public.admin_ad_slots s
    LEFT JOIN public.store_info f ON s.store_id::text = f.id::text
    LEFT JOIN public.combined_store_info c ON s.store_id::text = c.id::text
    WHERE s.page = $1 AND s.position = $2
  `;

  let sql = baseSelect;
  const params = [page, position];

  if (priority !== null && priority !== undefined) {
    sql += ` AND priority = $3 LIMIT 1`;
    params.push(priority);
  } else {
    sql += ` ORDER BY (priority IS NULL) DESC, priority ASC NULLS LAST, id DESC LIMIT 1`;
  }

  const { rows } = await pool.query(sql, params);
  return rows[0] || null;
}

function safeUnlinkByPublicUrl(publicUrl) {
  try {
    const u = clean(publicUrl);
    if (!u.startsWith("/uploads/")) return;
    const filename = u.replace("/uploads/", "");
    const abs = path.join(UPLOAD_DIR, filename);
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  } catch {
    // ignore
  }
}

/**
 * GET /foodcategorymanager/ad/slot?page=...&position=...&priority=...
 */
export async function getSlot(req, res) {
  try {
    const page = clean(req.query.page);
    const position = clean(req.query.position);
    const priRaw = clean(req.query.priority);

    if (!page || !position) {
      return res.status(400).json({ success: false, error: "page/position required" });
    }

    const priority = priRaw ? Number(priRaw) : null;
    const slot = await fetchSlot({ page, position, priority });

    return res.json({ success: true, slot });
  } catch (e) {
    console.error("getSlot error:", e);
    return res.status(500).json({ success: false, error: "server error" });
  }
}

/**
 * POST /foodcategorymanager/ad/slot (multipart/form-data)
 * - file field: image (or slotImage)
 * - body: imageUrl 이 있으면 업로드 파일이 없을 때 그 URL을 사용
 */
export async function saveSlot(req, res) {
  const client = await pool.connect();
  try {
    const b = req.body || {};

    const page = clean(b.page);
    const position = clean(b.position);
    if (!page || !position) {
      return res.status(400).json({ success: false, error: "page/position required" });
    }

    const priority = clean(b.priority) ? Number(b.priority) : null;

    const slotType = clean(b.slotType || b.slot_type) || "banner";
    const slotMode = clean(b.slotMode || b.slot_mode) || "banner";

    const linkUrl = clean(b.linkUrl || b.link_url || b.link);
    const textContent = clean(b.textContent || b.text_content || b.content);

    const storeId = clean(b.storeId || b.store_id);
    const businessNo = clean(b.businessNo || b.business_no);
    const businessName = clean(b.businessName || b.business_name);

    const startAtLocal = clean(b.startAt) || null;
    const endAtLocal = clean(b.endAt) || null;
    const noEnd = toBool(b.noEnd);

    const keepImage = toBool(b.keepImage);
    const clearImage = toBool(b.clearImage);

    // ✅ 가게 검색에서 넘어온 대표 이미지 URL (ex: /uploads/xxx.jpg 또는 절대경로)
    const overrideImageUrl = clean(b.imageUrl || b.image_url);

    const uploaded = req.file;
    const newImageUrl = uploaded ? `/uploads/${uploaded.filename}` : "";

    await client.query("BEGIN");

    let existing = null;
    if (priority === null) {
      const { rows } = await client.query(
        `SELECT * FROM public.admin_ad_slots WHERE page=$1 AND position=$2 AND priority IS NULL LIMIT 1 FOR UPDATE`,
        [page, position]
      );
      existing = rows[0] || null;
    } else {
      const { rows } = await client.query(
        `SELECT * FROM public.admin_ad_slots WHERE page=$1 AND position=$2 AND priority=$3 LIMIT 1 FOR UPDATE`,
        [page, position, priority]
      );
      existing = rows[0] || null;
    }

    // ✅ 최종 이미지 결정
    let finalImageUrl = existing?.image_url || null;

    if (clearImage) {
      if (finalImageUrl) safeUnlinkByPublicUrl(finalImageUrl);
      finalImageUrl = null;
    } else if (uploaded) {
      if (finalImageUrl && finalImageUrl !== newImageUrl) safeUnlinkByPublicUrl(finalImageUrl);
      finalImageUrl = newImageUrl;
    } else if (overrideImageUrl) {
      // 가게 대표 이미지로 교체할 때, 기존 /uploads/ 이미지가 있으면 정리
      if (finalImageUrl && finalImageUrl !== overrideImageUrl) {
        safeUnlinkByPublicUrl(finalImageUrl);
      }
      finalImageUrl = overrideImageUrl;
    } else {
      if (!existing?.image_url && !keepImage) {
        finalImageUrl = null;
      }
    }

    const startAtExpr = startAtLocal ? `NULLIF($9, '')::timestamp AT TIME ZONE '${TZ}'` : "NULL";
    const endAtExpr = !noEnd && endAtLocal ? `NULLIF($10, '')::timestamp AT TIME ZONE '${TZ}'` : "NULL";

    if (existing) {
      const params = [
        slotType,            // $1
        slotMode,            // $2
        linkUrl || null,     // $3
        textContent || null, // $4
        storeId || null,     // $5
        businessNo || null,  // $6
        businessName || null,// $7
        finalImageUrl,       // $8
        startAtLocal || null,// $9
        endAtLocal || null,  // $10
        noEnd,               // $11
        page,                // $12
        position,            // $13
        priority,            // $14
      ];

      const whereClause =
        priority === null
          ? `WHERE page=$12 AND position=$13 AND priority IS NULL`
          : `WHERE page=$12 AND position=$13 AND priority=$14`;

      const updateSql = `
        UPDATE public.admin_ad_slots
        SET
          slot_type=$1,
          slot_mode=$2,
          link_url=$3,
          text_content=$4,
          store_id=$5,
          business_no=$6,
          business_name=$7,
          image_url=$8,
          start_at=${startAtExpr},
          end_at=${endAtExpr},
          no_end=$11,
          updated_at=NOW()
        ${whereClause}
        RETURNING id
      `;

      await client.query(updateSql, params);
    } else {
      const insertSql = `
        INSERT INTO public.admin_ad_slots
          (page, position, priority, image_url, link_url, slot_type, slot_mode, text_content,
           store_id, business_no, business_name,
           start_at, end_at, no_end, created_at, updated_at)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8,
           $9, $10, $11,
           ${startAtLocal ? `NULLIF($12, '')::timestamp AT TIME ZONE '${TZ}'` : "NULL"},
           ${!noEnd && endAtLocal ? `NULLIF($13, '')::timestamp AT TIME ZONE '${TZ}'` : "NULL"},
           $14, NOW(), NOW())
        RETURNING id
      `;

      await client.query(insertSql, [
        page,
        position,
        priority,
        finalImageUrl,
        linkUrl || null,
        slotType,
        slotMode,
        textContent || null,
        storeId || null,
        businessNo || null,
        businessName || null,
        startAtLocal || null,
        endAtLocal || null,
        noEnd,
      ]);
    }

    await client.query("COMMIT");

    const slot = await fetchSlot({ page, position, priority });
    return res.json({ success: true, slot, debug: { keepImage, clearImage, overrideImageUrl } });
  } catch (e) {
    try { await client.query("ROLLBACK"); } catch { }
    console.error("saveSlot error:", e);
    return res.status(500).json({ success: false, error: "server error" });
  } finally {
    client.release();
  }
}

/**
 * DELETE /foodcategorymanager/ad/slot?page=...&position=...&priority=...
 */
export async function deleteSlot(req, res) {
  const client = await pool.connect();
  try {
    const page = clean(req.query.page);
    const position = clean(req.query.position);
    const priRaw = clean(req.query.priority);

    if (!page || !position) {
      return res.status(400).json({ success: false, error: "page/position required" });
    }

    const priority = priRaw ? Number(priRaw) : null;

    await client.query("BEGIN");

    let existing = null;
    if (priority === null) {
      const { rows } = await client.query(
        `SELECT * FROM public.admin_ad_slots WHERE page=$1 AND position=$2 AND priority IS NULL LIMIT 1 FOR UPDATE`,
        [page, position]
      );
      existing = rows[0] || null;
    } else {
      const { rows } = await client.query(
        `SELECT * FROM public.admin_ad_slots WHERE page=$1 AND position=$2 AND priority=$3 LIMIT 1 FOR UPDATE`,
        [page, position, priority]
      );
      existing = rows[0] || null;
    }

    if (!existing) {
      await client.query("ROLLBACK");
      return res.json({ success: true, deleted: 0 });
    }

    if (existing.image_url) safeUnlinkByPublicUrl(existing.image_url);

    if (priority === null) {
      await client.query(
        `DELETE FROM public.admin_ad_slots WHERE page=$1 AND position=$2 AND priority IS NULL`,
        [page, position]
      );
    } else {
      await client.query(
        `DELETE FROM public.admin_ad_slots WHERE page=$1 AND position=$2 AND priority=$3`,
        [page, position, priority]
      );
    }

    await client.query("COMMIT");
    return res.json({ success: true, deleted: 1 });
  } catch (e) {
    try { await client.query("ROLLBACK"); } catch { }
    console.error("deleteSlot error:", e);
    return res.status(500).json({ success: false, error: "server error" });
  } finally {
    client.release();
  }
}

/**
 * GET /foodcategorymanager/ad/store/search?bizNo=...&q=...
 * 응답: { ok:true, stores:[{id,business_no,business_name,category,image_url}] }
 */
export async function searchStore(req, res) {
  try {
    const bizNo = digitsOnly(req.query.bizNo);
    const q = clean(req.query.q);

    let sql = `
      SELECT
        s.id::text AS id,
        regexp_replace(COALESCE(s.business_number::text,''), '[^0-9]', '', 'g') AS business_no,
        s.business_name,
        COALESCE(s.detail_category, s.business_category) AS category,
        img.url AS image_url
      FROM public.store_info s
      LEFT JOIN LATERAL (
        SELECT url
          FROM public.store_images
         WHERE store_id = s.id
         ORDER BY sort_order, id
         LIMIT 1
      ) img ON TRUE
      WHERE 1=1
    `;

    const params = [];

    if (bizNo) {
      params.push(bizNo);
      sql += ` AND regexp_replace(COALESCE(s.business_number::text,''), '[^0-9]', '', 'g') = $${params.length}`;
    }
    if (q) {
      params.push(`%${q}%`);
      sql += ` AND s.business_name ILIKE $${params.length}`;
    }

    sql += ` ORDER BY s.id DESC LIMIT 30`;

    const { rows } = await pool.query(sql, params);
    return res.json({ ok: true, stores: rows || [] });
  } catch (e) {
    console.error("searchStore error:", e);
    return res.status(500).json({ ok: false, error: "server error" });
  }
}
