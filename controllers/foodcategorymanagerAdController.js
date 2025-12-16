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

/**
 * 광고 슬롯 1개 조회 (페이지/포지션/우선순위)
 */


/**
 * /uploads/... 형태 public URL을 실제 파일 경로로 지우기
 */
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
      return res
        .status(400)
        .json({ success: false, error: "page/position required" });
    }

    const priority = priRaw ? Number(priRaw) : null;
    const slot = await fetchSlot({ page, position, priority });

    return res.json({ success: true, slot });
  } catch (e) {
    console.error("❌ getSlot error:", e);
    console.error("❌ getSlot message:", e.message);
    console.error("❌ getSlot stack:", e.stack);
    if (e.code) console.error("❌ PG Error code:", e.code);
    if (e.detail) console.error("❌ PG Error detail:", e.detail);
    return res
      .status(500)
      .json({ success: false, error: e.message || "server error" });
  }
}

/**
 * POST /foodcategorymanager/ad/slot (multipart/form-data)
 * - file field: image (or slotImage)  ※ router multer 설정과 일치해야 req.file 잡힘
 */
export async function saveSlot(req, res) {
  const client = await pool.connect();
  try {
    const b = req.body || {};

    const page = clean(b.page);
    const position = clean(b.position);
    if (!page || !position) {
      return res
        .status(400)
        .json({ success: false, error: "page/position required" });
    }

    const priority = clean(b.priority) ? Number(b.priority) : null;

    const slotType = clean(b.slotType || b.slot_type) || "banner";
    const slotMode = clean(b.slotMode || b.slot_mode) || "banner";

    const linkUrl = clean(b.linkUrl || b.link_url || b.link) || null;
    const textContent = clean(b.textContent || b.text_content || b.content) || null;

    const storeId = clean(b.storeId || b.store_id) || null;
    const businessNo = clean(b.businessNo || b.business_no) || null;
    const businessName = clean(b.businessName || b.business_name) || null;

    // ✅ 프론트가 빈값("")으로 보내도 OK: NULLIF로 처리
    const startAtLocal = clean(b.startAt || b.start_at) || "";
    const endAtLocal = clean(b.endAt || b.end_at) || "";
    const noEnd = toBool(b.noEnd || b.no_end);

    const keepImage = toBool(b.keepImage);
    const clearImage = toBool(b.clearImage);
    const overrideImageUrl = clean(b.imageUrl || b.image_url);

    const uploaded = req.file;
    const newImageUrl = uploaded ? `/uploads/${uploaded.filename}` : "";

    await client.query("BEGIN");

    // 🔒 기존 슬롯 잠그기 (동일 page/position/priority)
    let existing = null;
    if (priority === null) {
      const { rows } = await client.query(
        `SELECT * FROM public.admin_ad_slots 
         WHERE page=$1 AND position=$2 AND priority IS NULL 
         LIMIT 1 FOR UPDATE`,
        [page, position]
      );
      existing = rows[0] || null;
    } else {
      const { rows } = await client.query(
        `SELECT * FROM public.admin_ad_slots 
         WHERE page=$1 AND position=$2 AND priority=$3 
         LIMIT 1 FOR UPDATE`,
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
      if (finalImageUrl && finalImageUrl !== newImageUrl) {
        safeUnlinkByPublicUrl(finalImageUrl);
      }
      finalImageUrl = newImageUrl;
    } else if (overrideImageUrl) {
      if (finalImageUrl && finalImageUrl !== overrideImageUrl) {
        safeUnlinkByPublicUrl(finalImageUrl);
      }
      finalImageUrl = overrideImageUrl;
    } else {
      // 기존 슬롯이 없고 keepImage도 아니면 이미지 없음 유지
      if (!existing?.image_url && !keepImage) {
        finalImageUrl = null;
      }
    }

    if (existing) {
      // ✅ UPDATE
      const params = [
        slotType, // $1
        slotMode, // $2
        linkUrl, // $3
        textContent, // $4
        storeId, // $5
        businessNo, // $6
        businessName, // $7
        finalImageUrl, // $8
        startAtLocal, // $9
        endAtLocal, // $10
        noEnd, // $11
        page, // $12
        position, // $13
        priority, // $14
      ];

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
          start_at = NULLIF($9, '')::timestamp AT TIME ZONE '${TZ}',
          end_at   = NULLIF($10, '')::timestamp AT TIME ZONE '${TZ}',
          no_end=$11,
          updated_at=NOW()
        WHERE page=$12
          AND position=$13
          AND ( ($14::int IS NULL AND priority IS NULL) OR priority=$14::int )
        RETURNING id
      `;

      await client.query(updateSql, params);
    } else {
      // ✅ INSERT
      const insertSql = `
        INSERT INTO public.admin_ad_slots
          (page, position, priority, image_url, link_url, slot_type, slot_mode, text_content,
           store_id, business_no, business_name,
           start_at, end_at, no_end, created_at, updated_at)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8,
           $9, $10, $11,
           NULLIF($12, '')::timestamp AT TIME ZONE '${TZ}',
           NULLIF($13, '')::timestamp AT TIME ZONE '${TZ}',
           $14, NOW(), NOW())
        RETURNING id
      `;

      await client.query(insertSql, [
        page, // $1
        position, // $2
        priority, // $3
        finalImageUrl, // $4
        linkUrl, // $5
        slotType, // $6
        slotMode, // $7
        textContent, // $8
        storeId, // $9
        businessNo, // $10
        businessName, // $11
        startAtLocal, // $12
        endAtLocal, // $13
        noEnd, // $14
      ]);
    }

    await client.query("COMMIT");

    // ✅ 저장 후 최신 데이터 다시 조회해서 프론트로 전달
    const slot = await fetchSlot({ page, position, priority });
    return res.json({ success: true, slot });
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {}
    console.error("❌ saveSlot error:", e);
    console.error("❌ Error message:", e.message);
    console.error("❌ Error stack:", e.stack);
    if (e.code) console.error("❌ PG Error code:", e.code);
    if (e.detail) console.error("❌ PG Error detail:", e.detail);
    return res
      .status(500)
      .json({ success: false, error: e.message || "server error" });
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
      return res
        .status(400)
        .json({ success: false, error: "page/position required" });
    }

    const priority = priRaw ? Number(priRaw) : null;

    await client.query("BEGIN");

    let existing = null;
    if (priority === null) {
      const { rows } = await client.query(
        `SELECT * FROM public.admin_ad_slots 
         WHERE page=$1 AND position=$2 AND priority IS NULL 
         LIMIT 1 FOR UPDATE`,
        [page, position]
      );
      existing = rows[0] || null;
    } else {
      const { rows } = await client.query(
        `SELECT * FROM public.admin_ad_slots 
         WHERE page=$1 AND position=$2 AND priority=$3 
         LIMIT 1 FOR UPDATE`,
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
        `DELETE FROM public.admin_ad_slots 
         WHERE page=$1 AND position=$2 AND priority IS NULL`,
        [page, position]
      );
    } else {
      await client.query(
        `DELETE FROM public.admin_ad_slots 
         WHERE page=$1 AND position=$2 AND priority=$3`,
        [page, position, priority]
      );
    }

    await client.query("COMMIT");
    return res.json({ success: true, deleted: 1 });
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {}
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

    const params = [];
    let cond = ` WHERE 1=1 `;

    if (bizNo) {
      params.push(bizNo);
      cond += ` AND regexp_replace(COALESCE(t.business_number::text,''), '[^0-9]', '', 'g') = $${params.length} `;
    }
    if (q) {
      params.push(`%${q}%`);
      cond += ` AND t.business_name ILIKE $${params.length} `;
    }

    const sql = `
      WITH candidates AS (
        SELECT
          s.id::text AS id,
          regexp_replace(COALESCE(s.business_number::text,''), '[^0-9]', '', 'g') AS business_no,
          s.business_name,
          COALESCE(s.business_category, '') AS category,
          NULL::text AS main_image_url
        FROM public.store_info s
        CROSS JOIN LATERAL (SELECT s.business_number, s.business_name, s.business_category) t
        ${cond.replaceAll("t.", "s.")}

        UNION ALL

        SELECT
          c.id::text AS id,
          regexp_replace(COALESCE(c.business_number::text,''), '[^0-9]', '', 'g') AS business_no,
          c.business_name,
          COALESCE(c.business_category, '') AS category,
          c.main_image_url AS main_image_url
        FROM public.combined_store_info c
        CROSS JOIN LATERAL (SELECT c.business_number, c.business_name, c.business_category) t
        ${cond.replaceAll("t.", "c.")}
      )
      SELECT DISTINCT ON (id)
        id,
        business_no,
        business_name,
        category,
        COALESCE(
          img.url,
          candidates.main_image_url
        ) AS image_url
      FROM candidates
      LEFT JOIN LATERAL (
        SELECT url
          FROM public.store_images
         WHERE store_id::text = candidates.id
         ORDER BY sort_order, id
         LIMIT 1
      ) img ON TRUE
      ORDER BY id, business_name
      LIMIT 50
    `;

    const { rows } = await pool.query(sql, params);
    return res.json({ ok: true, stores: rows || [] });
  } catch (e) {
    console.error("❌ searchStore error:", e);
    return res
      .status(500)
      .json({ ok: false, error: e.message || "server error" });
  }
}

