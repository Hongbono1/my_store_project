// controllers/managerAdController.js
import fs from "fs";
import path from "path";
import pool from "../db.js";

const TZ = "Asia/Seoul";
const UPLOAD_DIR = process.env.UPLOAD_DIR || "/data/uploads"; // 서버 운영 경로에 맞게
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
      id,
      page,
      position,
      priority,
      image_url,
      link_url,
      slot_type,
      slot_mode,
      text_content,
      store_id::text AS store_id,
      business_no,
      business_name,
      no_end,
      to_char(start_at AT TIME ZONE '${TZ}', 'YYYY-MM-DD"T"HH24:MI') AS start_at_local,
      to_char(end_at   AT TIME ZONE '${TZ}', 'YYYY-MM-DD"T"HH24:MI') AS end_at_local
    FROM public.admin_ad_slots
    WHERE page = $1 AND position = $2
  `;

    let sql = baseSelect;
    const params = [page, position];

    if (priority !== null && priority !== undefined) {
        sql += ` AND priority = $3 LIMIT 1`;
        params.push(priority);
    } else {
        // 기본(우선 priority IS NULL), 없으면 가장 낮은 priority 1건
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
        // 조용히 무시
    }
}

/**
 * GET /manager/ad/slot?page=...&position=...&priority=...
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
 * POST /manager/ad/slot  (multipart/form-data)
 * - file field: image
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

        const startAtLocal = clean(b.startAt);
        const endAtLocal = clean(b.endAt);
        const noEnd = toBool(b.noEnd);

        const keepImage = toBool(b.keepImage);
        const clearImage = toBool(b.clearImage);

        const uploaded = req.file; // multer single("image")
        const newImageUrl = uploaded ? `/uploads/${uploaded.filename}` : "";

        // 기존 슬롯(업데이트/파일 정리용)
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

        // 이미지 결정: (안전) 기본은 "유지"
        let finalImageUrl = existing?.image_url || null;

        if (clearImage) {
            // 기존 이미지 삭제(파일도 삭제)
            if (finalImageUrl) safeUnlinkByPublicUrl(finalImageUrl);
            finalImageUrl = null;
        } else if (uploaded) {
            // 새 이미지 업로드 → 교체(기존 파일 삭제)
            if (finalImageUrl && finalImageUrl !== newImageUrl) safeUnlinkByPublicUrl(finalImageUrl);
            finalImageUrl = newImageUrl;
        } else {
            // 파일 없으면 유지(keepImage는 있어도 없어도 유지)
            // 단, 기존이 없고 keepImage 체크/해제와 무관하게 null 유지
            if (!existing?.image_url) finalImageUrl = null;
        }

        // 기간: datetime-local(KST) → timestamptz 저장
        // noEnd=true면 end_at은 NULL
        const startAtExpr = startAtLocal ? `($9)::timestamp AT TIME ZONE '${TZ}'` : "NULL";
        const endAtExpr = !noEnd && endAtLocal ? `($10)::timestamp AT TIME ZONE '${TZ}'` : "NULL";

        if (existing) {
            const params = [
                slotType, // $1
                slotMode, // $2
                linkUrl || null, // $3
                textContent || null, // $4
                storeId || null, // $5
                businessNo || null, // $6
                businessName || null, // $7
                finalImageUrl, // $8
                startAtLocal || null, // $9
                endAtLocal || null, // $10
                noEnd, // $11
                page, // $12
                position, // $13
                priority, // $14
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
           ${startAtLocal ? `($12)::timestamp AT TIME ZONE '${TZ}'` : "NULL"},
           ${!noEnd && endAtLocal ? `($13)::timestamp AT TIME ZONE '${TZ}'` : "NULL"},
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

        // 저장 후 최신 1건 재조회(프론트가 기대하는 start_at_local/end_at_local 포함)
        const slot = await fetchSlot({ page, position, priority });

        return res.json({ success: true, slot, debug: { keepImage, clearImage } });
    } catch (e) {
        await client.query("ROLLBACK");
        console.error("saveSlot error:", e);
        return res.status(500).json({ success: false, error: "server error" });
    } finally {
        client.release();
    }
}

/**
 * DELETE /manager/ad/slot?page=...&position=...&priority=...
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

        // 지울 이미지 파일 확인
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
        await client.query("ROLLBACK");
        console.error("deleteSlot error:", e);
        return res.status(500).json({ success: false, error: "server error" });
    } finally {
        client.release();
    }
}

/**
 * GET /manager/ad/store/search?bizNo=...&q=...
 * 응답: { ok:true, stores:[{id,business_no,business_name,category}] }
 */
export async function searchStore(req, res) {
    try {
        const bizNo = digitsOnly(req.query.bizNo);
        const q = clean(req.query.q);

        // ✅ 통합 뷰/테이블 기준: combined_store_info
        // 컬럼명이 다르면 여기만 너 DB에 맞게 바꾸면 됨.
        let sql = `
  SELECT
    id::text AS id,
    regexp_replace(COALESCE(business_number::text,''), '[^0-9]', '', 'g') AS business_no,
    business_name,
    business_category AS category
  FROM public.combined_store_info
  WHERE 1=1
`;

        const params = [];

        if (bizNo) {
            params.push(bizNo);
            sql += ` AND regexp_replace(COALESCE(business_number::text,''), '[^0-9]', '', 'g') = $${params.length}`;
        }
        if (q) {
            params.push(`%${q}%`);
            sql += ` AND business_name ILIKE $${params.length}`;
        }

        sql += ` ORDER BY id DESC LIMIT 30`;

        const { rows } = await pool.query(sql, params);
        return res.json({ ok: true, stores: rows || [] });
    } catch (e) {
        console.error("searchStore error:", e);
        return res.status(500).json({ ok: false, error: "server error" });
    }


}
