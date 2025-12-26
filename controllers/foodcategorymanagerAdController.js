// controllers/foodcategorymanagerAdController.js
import fs from "fs";
import path from "path";
import pool from "../db.js";

const TZ = "Asia/Seoul";
const UPLOAD_DIR = process.env.UPLOAD_DIR || "/data/uploads";
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// -------------------- 공통 유틸 --------------------
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
 * ✅ position 정규화(사이드 광고 2/3 연결 핵심)
 * - food_sidebar_ad_2  -> food_sidebar_ad2
 * - food_sidebar_ad_3  -> food_sidebar_ad3
 * (ad1은 원래 ad로 쓰는 경우가 많아서 건드리지 않음)
 */
function normalizePosition(pos) {
  const p = clean(pos);
  if (!p) return "";
  // _ad_2 / _ad_3 형태만 정규화
  return p
    .replace(/_ad_2$/i, "_ad2")
    .replace(/_ad_3$/i, "_ad3");
}

// ⚠️ 주의: 광고 슬롯의 image_url이 "가게 공용 이미지"를 가리킬 수 있어서,
//      여기서 파일을 지워버리면 다른 슬롯/가게에서도 이미지가 깨질 수 있음.
//      그래서 슬롯 reset/delete에서는 unlink 하지 않도록 아래 로직에서 사용을 제한함.
function safeUnlinkByPublicUrl(publicUrl) {
  try {
    const u = clean(publicUrl);
    if (!u.startsWith("/uploads/")) return;

    const filename = u.replace("/uploads/", "");
    const normalized = path.posix.normalize(filename).replace(/^(\.\.(\/|\\|$))+/, "");
    const abs = path.resolve(UPLOAD_DIR, normalized);
    const base = path.resolve(UPLOAD_DIR) + path.sep;

    if (!abs.startsWith(base)) return;
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  } catch {
    // ignore
  }
}

// -------------------- 슬롯 조회용 공통 함수 --------------------
async function fetchSlot({ page, position, priority }) {
  const baseSelect = `
    SELECT
      s.id,
      s.page,
      s.position,
      s.priority,

      -- ✅ URL 정규화: /data/uploads/... -> /uploads/... , 상대경로면 / 붙임
      COALESCE(
        NULLIF(s.image_url, ''),
        NULLIF(
          CASE
            WHEN img.url IS NULL OR img.url = '' THEN NULL
            WHEN img.url LIKE 'http%' THEN img.url
            WHEN img.url LIKE '/data/uploads/%' THEN regexp_replace(img.url, '^/data/uploads/', '/uploads/')
            WHEN left(img.url, 1) = '/' THEN img.url
            ELSE '/' || img.url
          END
        , ''),
        NULLIF(
          CASE
            WHEN c.main_image_url IS NULL OR c.main_image_url = '' THEN NULL
            WHEN c.main_image_url LIKE 'http%' THEN c.main_image_url
            WHEN c.main_image_url LIKE '/data/uploads/%' THEN regexp_replace(c.main_image_url, '^/data/uploads/', '/uploads/')
            WHEN left(c.main_image_url, 1) = '/' THEN c.main_image_url
            ELSE '/' || c.main_image_url
          END
        , '')
      ) AS image_url,

      s.link_url,
      s.slot_type,
      s.slot_mode,
      s.text_content,
      s.store_id::text AS store_id,
      s.business_no,
      s.table_source,

      -- ✅ table_source에 따라 올바른 테이블에서 데이터 가져오기 (NULL이면 store_info)
      COALESCE(
        NULLIF(s.business_name, ''),
        CASE 
          WHEN s.table_source = 'store_info' OR s.table_source IS NULL THEN si.business_name
          WHEN s.table_source = 'food_stores' THEN fs.business_name
          WHEN s.table_source = 'combined_store_info' THEN c.business_name
          ELSE ''
        END,
        ''
      ) AS business_name,
      
      -- ✅ business_category 우선 (한식/양식/중식), 없으면 business_type (NULL이면 store_info)
      COALESCE(
        CASE 
          WHEN s.table_source = 'store_info' OR s.table_source IS NULL THEN COALESCE(NULLIF(si.business_category, ''), si.business_type, '')
          WHEN s.table_source = 'food_stores' THEN COALESCE(NULLIF(fs.business_category, ''), fs.business_type, '')
          WHEN s.table_source = 'combined_store_info' THEN COALESCE(NULLIF(c.business_category, ''), c.business_type, '')
          ELSE ''
        END,
        ''
      ) AS category,

      s.no_end,
      to_char(s.start_at AT TIME ZONE '${TZ}', 'YYYY-MM-DD"T"HH24:MI') AS start_at_local,
      to_char(s.end_at   AT TIME ZONE '${TZ}', 'YYYY-MM-DD"T"HH24:MI') AS end_at_local

    FROM public.admin_ad_slots s

    LEFT JOIN public.combined_store_info c
      ON s.store_id = c.id AND s.table_source = 'combined_store_info'
      
    LEFT JOIN public.store_info si
      ON s.store_id = si.id AND (s.table_source = 'store_info' OR s.table_source IS NULL)
      
    LEFT JOIN public.food_stores fs
      ON s.store_id = fs.id AND s.table_source = 'food_stores'

    LEFT JOIN LATERAL (
      SELECT url
      FROM public.store_images
      WHERE store_id::text = s.store_id::text
        AND (s.table_source = 'store_info' OR s.table_source IS NULL)
      ORDER BY sort_order, id
      LIMIT 1
    ) img ON TRUE

    WHERE s.page = $1 AND s.position = $2
  `;

  let sql = baseSelect;
  const params = [page, position];

  if (priority !== null && priority !== undefined) {
    sql += ` AND s.priority = $3 LIMIT 1`;
    params.push(priority);
  } else {
    sql += ` ORDER BY (s.priority IS NULL) DESC, s.priority ASC NULLS LAST, s.id DESC LIMIT 1`;
  }

  const { rows } = await pool.query(sql, params);
  return rows[0] || null;
}

// -------------------- 슬롯 데이터 정규화 --------------------
function normalizeSlotData(slot) {
  if (!slot) return null;

  // ✅ table_source → store_type 정규화
  let storeType = slot.table_source ?? null;
  if (storeType === "combined_store_info") storeType = "combined";
  else if (storeType === "food_stores") storeType = "food";
  else if (storeType === "store_info") storeType = "store_info";

  const storeId = slot.store_id ?? null;

  // ✅ link_url은 "store 모드"일 때만 강제 재생성(배너/텍스트 링크 덮어쓰기 방지)
  let finalLinkUrl = slot.link_url ?? null;
  if (slot.slot_mode === "store" && storeId && storeType) {
    finalLinkUrl = `/ndetail.html?id=${storeId}&type=${storeType}`;
  }

  return {
    ...slot,
    store_type: storeType,
    link_url: finalLinkUrl,
  };
}

// -------------------- GET /foodcategorymanager/ad/slot --------------------
export async function getSlot(req, res) {
  try {
    const page = clean(req.query.page);
    // ✅ 여기!
    const position = normalizePosition(req.query.position);
    const priRaw = clean(req.query.priority);

    if (!page || !position) {
      return res.status(400).json({ success: false, error: "page/position required" });
    }

    const priority = priRaw ? Number(priRaw) : null;
    const slot = await fetchSlot({ page, position, priority });

    const normalizedSlot = normalizeSlotData(slot);
    return res.json({ success: true, slot: normalizedSlot });
  } catch (e) {
    console.error("❌ getSlot error:", e);
    return res.status(500).json({ success: false, error: e.message || "server error" });
  }
}

// -------------------- POST /foodcategorymanager/ad/slot --------------------
export async function saveSlot(req, res) {
  const client = await pool.connect();
  try {
    const b = req.body || {};

    const page = clean(b.page);
    // ✅ 여기!
    const position = normalizePosition(b.position);
    if (!page || !position) {
      return res.status(400).json({ success: false, error: "page/position required" });
    }

    const priority = clean(b.priority) ? Number(b.priority) : null;

    let slotType = clean(b.slotType || b.slot_type) || "banner";
    let slotMode = clean(b.slotMode || b.slot_mode) || "banner";

    let linkUrl = clean(b.linkUrl || b.link_url || b.link) || null;
    let textContent = clean(b.textContent || b.text_content || b.content) || null;

    let storeId = clean(b.storeId || b.store_id) || null;
    let businessNo = clean(b.businessNo || b.business_no) || null;
    let businessName = clean(b.businessName || b.business_name) || null;
    let tableSource = clean(b.tableSource || b.table_source) || "store_info";

    // ✅ table_source 유효성 검증
    if (!["store_info", "combined_store_info", "food_stores"].includes(tableSource)) {
      tableSource = "store_info";
    }

    // ✅ 재발 방지: "store 모드"에서만 link_url 자동 생성
    if (slotMode === "store" && storeId && !linkUrl) {
      if (tableSource === "combined_store_info") linkUrl = `/ndetail.html?id=${storeId}&type=combined`;
      else if (tableSource === "store_info") linkUrl = `/ndetail.html?id=${storeId}&type=store_info`;
      else if (tableSource === "food_stores") linkUrl = `/ndetail.html?id=${storeId}&type=food`;
    }

    let startAtLocal = clean(b.startAt || b.start_at) || "";
    let endAtLocal = clean(b.endAt || b.end_at) || "";
    let noEnd = toBool(b.noEnd || b.no_end);

    const keepImage = toBool(b.keepImage);
    const clearImage = toBool(b.clearImage);

    const overrideImageUrl = clean(b.imageUrl || b.image_url);

    const uploaded = req.file;
    const newImageUrl = uploaded ? `/uploads/${uploaded.filename}` : "";

    await client.query("BEGIN");

    let existing = null;
    if (priority === null) {
      const { rows } = await client.query(
        `
        SELECT *
        FROM public.admin_ad_slots
        WHERE page=$1 AND position=$2 AND priority IS NULL
        LIMIT 1
        FOR UPDATE
        `,
        [page, position]
      );
      existing = rows[0] || null;
    } else {
      const { rows } = await client.query(
        `
        SELECT *
        FROM public.admin_ad_slots
        WHERE page=$1 AND position=$2 AND priority=$3
        LIMIT 1
        FOR UPDATE
        `,
        [page, position, priority]
      );
      existing = rows[0] || null;
    }

    // ✅ "입력초기화" 동작: clearImage=true가 오면
    if (clearImage && !uploaded && !overrideImageUrl) {
      slotType = "banner";
      slotMode = "banner";

      linkUrl = null;
      textContent = null;

      storeId = null;
      businessNo = null;
      businessName = null;

      startAtLocal = "";
      endAtLocal = "";
      noEnd = false;
    }

    // ✅ 최종 이미지 결정 (파일 삭제 X)
    let finalImageUrl = existing?.image_url || null;

    if (clearImage) {
      finalImageUrl = null;
    } else if (uploaded) {
      finalImageUrl = newImageUrl;
    } else if (overrideImageUrl) {
      finalImageUrl = overrideImageUrl;
    } else {
      if (!existing?.image_url && !keepImage) {
        finalImageUrl = null;
      }
    }

    if (existing) {
      // ✅ UPDATE
      const params = [
        slotType,      // $1
        slotMode,      // $2
        linkUrl,       // $3
        textContent,   // $4
        storeId,       // $5
        businessNo,    // $6
        businessName,  // $7
        tableSource,   // $8
        finalImageUrl, // $9
        startAtLocal,  // $10
        endAtLocal,    // $11
        noEnd,         // $12
        page,          // $13
        position,      // $14
        priority,      // $15
      ];

      const updateSql = `
        UPDATE public.admin_ad_slots
        SET
          slot_type     = $1,
          slot_mode     = $2,
          link_url      = $3,
          text_content  = $4,
          store_id      = $5,
          business_no   = $6,
          business_name = $7,
          table_source  = $8,
          image_url     = $9,
          start_at      = NULLIF($10,  '')::timestamp AT TIME ZONE '${TZ}',
          end_at        = NULLIF($11, '')::timestamp AT TIME ZONE '${TZ}',
          no_end        = $12,
          updated_at    = NOW()
        WHERE page = $13
          AND position = $14
          AND (
            ($15::int IS NULL AND priority IS NULL)
            OR priority = $15::int
          )
        RETURNING id
      `;

      await client.query(updateSql, params);
    } else {
      // ✅ INSERT
      const insertSql = `
        INSERT INTO public.admin_ad_slots
          (page, position, priority, image_url, link_url,
           slot_type, slot_mode, text_content,
           store_id, business_no, business_name, table_source,
           start_at, end_at, no_end, created_at, updated_at)
        VALUES
          ($1, $2, $3, $4, $5,
           $6, $7, $8,
           $9, $10, $11, $12,
           NULLIF($13, '')::timestamp AT TIME ZONE '${TZ}',
           NULLIF($14, '')::timestamp AT TIME ZONE '${TZ}',
           $15, NOW(), NOW())
        RETURNING id
      `;

      await client.query(insertSql, [
        page, position, priority,
        finalImageUrl, linkUrl,
        slotType, slotMode, textContent,
        storeId, businessNo, businessName, tableSource,
        startAtLocal, endAtLocal, noEnd,
      ]);
    }

    await client.query("COMMIT");

    const slot = await fetchSlot({ page, position, priority });
    const normalizedSlot = normalizeSlotData(slot);
    return res.json({ success: true, slot: normalizedSlot });
  } catch (e) {
    try { await client.query("ROLLBACK"); } catch { }
    console.error("❌ saveSlot error:", e);
    return res.status(500).json({ success: false, error: e.message || "server error" });
  } finally {
    client.release();
  }
}

// -------------------- DELETE /foodcategorymanager/ad/slot --------------------
export async function deleteSlot(req, res) {
  const client = await pool.connect();
  try {
    const page = clean(req.query.page);
    // ✅ 여기!
    const position = normalizePosition(req.query.position);
    const priRaw = clean(req.query.priority);

    if (!page || !position) {
      return res.status(400).json({ success: false, error: "page/position required" });
    }

    const priority = priRaw ? Number(priRaw) : null;

    await client.query("BEGIN");

    let existing = null;
    if (priority === null) {
      const { rows } = await client.query(
        `
        SELECT *
        FROM public.admin_ad_slots
        WHERE page=$1 AND position=$2 AND priority IS NULL
        LIMIT 1
        FOR UPDATE
        `,
        [page, position]
      );
      existing = rows[0] || null;
    } else {
      const { rows } = await client.query(
        `
        SELECT *
        FROM public.admin_ad_slots
        WHERE page=$1 AND position=$2 AND priority=$3
        LIMIT 1
        FOR UPDATE
        `,
        [page, position, priority]
      );
      existing = rows[0] || null;
    }

    if (!existing) {
      await client.query("ROLLBACK");
      return res.json({ success: true, deleted: 0 });
    }

    // ✅ 삭제 시에도 파일 unlink 하지 않음
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
    console.error("❌ deleteSlot error:", e);
    return res.status(500).json({ success: false, error: "server error" });
  } finally {
    client.release();
  }
}

// -------------------- GET /foodcategorymanager/ad/store/search
// -------------------- GET /foodcategorymanager/ad/search-store
export async function searchStore(req, res) {
  try {
    const bizNo = digitsOnly(req.query.bizNo);

    const qRaw = clean(req.query.q);
    const isAll = qRaw === "__all__";       // ✅ 여기!
    const q = isAll ? "" : qRaw;

    // ✅ 1) q=__all__ 이면: "푸드 사이드바용"으로 store_info만 전체 내려줌
    //    (통합/푸드_stores 섞이는 문제 방지)
    if (isAll && !bizNo) {
      const sql = `
        SELECT
          s.id::text AS id,
          'store_info' AS table_source,
          regexp_replace(COALESCE(s.business_number::text,''), '[^0-9]', '', 'g') AS business_no,
          s.business_name,
          COALESCE(s.business_category, '') AS category,
          COALESCE(s.detail_category, '') AS detail_category,
          COALESCE(img.url, NULL) AS image_url
        FROM public.store_info s
        LEFT JOIN LATERAL (
          SELECT url
          FROM public.store_images
          WHERE CAST(store_id AS text) = s.id::text
          ORDER BY sort_order, id
          LIMIT 1
        ) img ON TRUE
        ORDER BY s.id DESC
        LIMIT 2000;
      `;

      const { rows } = await pool.query(sql);
      return res.json({ ok: true, stores: rows || [] });
    }

    // ✅ 2) 그 외(검색/사업자번호): 기존 로직(UNION) 유지
    const params = [];
    const condS = [];
    const condC = [];
    const condF = [];

    if (bizNo) {
      params.push(bizNo);
      const idx = params.length;

      condS.push(`regexp_replace(COALESCE(s.business_number::text,''), '[^0-9]', '', 'g') = $${idx}`);
      condC.push(`regexp_replace(COALESCE(c.business_number::text,''), '[^0-9]', '', 'g') = $${idx}`);
      condF.push(`regexp_replace(COALESCE(f.business_number::text,''), '[^0-9]', '', 'g') = $${idx}`);
    }

    if (q) {
      params.push(`%${q}%`);
      const idx = params.length;

      condS.push(`s.business_name ILIKE $${idx}`);
      condC.push(`c.business_name ILIKE $${idx}`);
      condF.push(`f.business_name ILIKE $${idx}`);
    }

    const whereS = condS.length ? `WHERE ${condS.join(" AND ")}` : "";
    const whereC = condC.length ? `WHERE ${condC.join(" AND ")}` : "";
    const whereF = condF.length ? `WHERE ${condF.join(" AND ")}` : "";

    const sql = `
      WITH candidates AS (
        SELECT
          s.id::text AS id,
          'store_info' AS table_source,
          regexp_replace(COALESCE(s.business_number::text,''), '[^0-9]', '', 'g') AS business_no,
          s.business_name,
          COALESCE(s.business_category, '') AS category,
          NULL::text AS table_image
        FROM public.store_info s
        ${whereS}

        UNION ALL

        SELECT
          c.id::text AS id,
          'combined_store_info' AS table_source,
          regexp_replace(COALESCE(c.business_number::text,''), '[^0-9]', '', 'g') AS business_no,
          c.business_name,
          COALESCE(c.business_category, '') AS category,
          c.main_image_url AS table_image
        FROM public.combined_store_info c
        ${whereC}

        UNION ALL

        SELECT
          f.id::text AS id,
          'food_stores' AS table_source,
          regexp_replace(COALESCE(f.business_number::text,''), '[^0-9]', '', 'g') AS business_no,
          f.business_name,
          COALESCE(f.business_category, '') AS category,
          NULL::text AS table_image
        FROM public.food_stores f
        ${whereF}
      )
      SELECT DISTINCT ON (table_source, id)
        candidates.id,
        candidates.table_source,
        candidates.business_no,
        candidates.business_name,
        candidates.category,
        COALESCE(img.url, candidates.table_image) AS image_url
      FROM candidates
      LEFT JOIN LATERAL (
        SELECT url
        FROM public.store_images
        WHERE CAST(store_id AS text) = candidates.id
        ORDER BY sort_order, id
        LIMIT 1
      ) img ON TRUE
      ORDER BY candidates.table_source, candidates.id, candidates.business_name
      LIMIT 50;
    `;

    const { rows } = await pool.query(sql, params);
    return res.json({ ok: true, stores: rows || [] });
  } catch (e) {
    console.error("❌ searchStore error:", e);
    return res.status(500).json({ ok: false, error: e.message || "server error" });
  }
}

// -------------------- POST /foodcategorymanager/ad/fix-links/:tableSource --------------------
export async function fixLinks(req, res) {
  try {
    const tableSource = req.params.tableSource;

    let targetType = "";
    if (tableSource === "store_info") targetType = "store_info";
    else if (tableSource === "combined_store_info") targetType = "combined";
    else if (tableSource === "food_stores") targetType = "food";
    else return res.status(400).json({ success: false, error: "Invalid tableSource" });

    const result = await pool.query(
      `
      UPDATE public.admin_ad_slots
      SET link_url = '/ndetail.html?id=' || store_id || '&type=' || $1
      WHERE page = 'foodcategory'
        AND table_source = $2
        AND store_id IS NOT NULL
        AND (
          link_url IS NULL 
          OR link_url = ''
          OR link_url LIKE '%type=open%'
          OR link_url NOT LIKE '%type=${targetType}%'
        )
      RETURNING id, position, store_id, business_name, link_url;
      `,
      [targetType, tableSource]
    );

    return res.json({
      success: true,
      count: result.rowCount,
      updated: result.rows,
    });
  } catch (e) {
    console.error("❌ fixLinks error:", e);
    return res.status(500).json({ success: false, error: e.message || "server error" });
  }
}

// -------------------- GET /foodcategorymanager/ad/check-links --------------------
export async function checkLinks(req, res) {
  try {
    const { rows } = await pool.query(`
      SELECT 
        id,
        position,
        priority,
        table_source,
        store_id,
        business_name,
        link_url,
        CASE 
          WHEN link_url LIKE '%type=store_info%' THEN 'OK: store_info'
          WHEN link_url LIKE '%type=combined%' THEN 'OK: combined'
          WHEN link_url LIKE '%type=food%' THEN 'OK: food'
          WHEN link_url LIKE '%type=open%' THEN 'ERROR: type=open (outdated)'
          ELSE 'ERROR: invalid or missing type'
        END as status
      FROM public.admin_ad_slots
      WHERE page = 'foodcategory'
        AND store_id IS NOT NULL
      ORDER BY position, priority;
    `);

    return res.json({ success: true, slots: rows });
  } catch (e) {
    console.error("❌ checkLinks error:", e);
    return res.status(500).json({ success: false, error: e.message || "server error" });
  }
}

export async function debugStoreInfo(req, res) {
  try {
    const { rows } = await pool.query(`
      select
        count(*)::int as cnt,
        (select business_name from public.store_info order by id desc limit 1) as latest_name
      from public.store_info
    `);
    return res.json({ ok: true, ...rows[0] });
  } catch (e) {
    console.error("❌ debugStoreInfo error:", e);
    return res.status(500).json({ ok: false, error: e.message || "server error" });
  }
}
